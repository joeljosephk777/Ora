# Handoff Implementation Plan: Decoupled, Token-Optimized AI Infrastructure for Ora

This blueprint provides comprehensive engineering specifications for integrating the OpenRouter API with the `nvidia/nemotron-3-super-120b-a12b:free` model. It is designed to be passed directly to a coding agent (such as Cursor, Claude Engineer, or GitHub Copilot) to implement the backend requirements for Neil’s track while aligning cleanly with Garv’s frontend layout.

---

## Technical Architecture & Directory Structure

To keep the application loosely coupled, highly secure, and optimized for token limits, all AI integrations must reside on the server side. This layout abstracts the AI provider entirely from the API endpoint routing logic.

```
src/
├── lib/
│   └── llm/
│       ├── gateway.ts          # Central LLM Switchboard (Task 1)
│       └── providers/
│           └── openrouter.ts   # OpenRouter Payload & Stream Handler (Task 1 & 4)
└── app/
    └── api/
        ├── chat/
        │   └── route.ts        # Streamed Interview Endpoint (Task 2, 3, & 4)
        └── reports/
            └── generate/
                └── route.ts    # JSON Report Generation Endpoint (Task 5)
```

---

## Detailed Task Implementations

### Task 1: Loosely Coupled AI Abstraction Layer
**Objective:** Abstract vendor SDKs so models, providers, or local setups (like Ollama/vLLM) can be cleanly plugged or swapped without refactoring any endpoint files.

#### Specifications:
*   Create a vendor-agnostic gateway interface.
*   Isolate OpenRouter payload formatting into its own provider driver.
*   Enforce credential consumption strictly from `.env.local`.

```typescript
// src/lib/llm/gateway.ts
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

import { streamOpenRouter } from './providers/openrouter';

export async function streamLLMResponse(messages: ChatMessage[], options?: LLMOptions): Promise<ReadableStream> {
  const provider = process.env.LLM_PROVIDER || 'openrouter';

  switch (provider) {
    case 'openrouter':
      return await streamOpenRouter(messages, options);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
```

```typescript
// src/lib/llm/providers/openrouter.ts
import { ChatMessage, LLMOptions } from '../gateway';

export async function streamOpenRouter(messages: ChatMessage[], options?: LLMOptions): Promise<ReadableStream> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const defaultModel = 'nvidia/nemotron-3-super-120b-a12b:free';
  const model = options?.model || process.env.OPENROUTER_MODEL || defaultModel;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY configuration variable in environment.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/joeljosephk777/Ora",
      "X-Title": "Ora AI Chat"
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options?.temperature ?? 0.1, // Lower variance avoids wasting tokens
      max_tokens: options?.maxTokens ?? 175,    // Stringent output cap for free plan optimization
      stream: true
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter Network Exception: ${response.statusText}`);
  }

  return response.body!;
}
```

---

### Tasks 2 & 3: Context-Hydrated, Rubric-Driven Interview Route
**Objective:** Implement the `/api/chat` POST route to conduct an interactive, text-based interview using Server-Sent Events (SSE) streaming for real-time responsiveness. It must dynamically guide the student through the professor's rubric and criteria rather than dumping questions statically.

#### Token Minimization Strategy:
1.  **Selective Fetching:** Query *only* the absolute required columns (`role`, `content`) from Supabase to prevent wasting context space with unnecessary object metadata.
2.  **Dense Prompts:** Write the system instructions using ultra-compact markdown tokens instead of verbose conversational sentences.
3.  **Forced Conciseness:** Command the model to limit its conversational filler and focus entirely on executing exactly *one* tailored question at a time.

```typescript
// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Multi-tenant server client wrapper
import { streamLLMResponse } from '@/lib/llm/gateway';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { sessionId, studentMessage } = await request.json();

  // 1. Instantly capture and log student message execution to database
  if (studentMessage) {
    await supabase.from('messages').insert({ session_id: sessionId, role: 'student', content: studentMessage });
  }

  // 2. Token-Optimized Hydration: Extract text values selectively
  const { data: session } = await supabase.from('sessions').select('assignment_id, submission_id').eq('id', sessionId).single();
  
  const [assignmentData, submissionData, questionsData, historyData] = await Promise.all([
    supabase.from('assignments').select('description, rubric').eq('id', session.assignment_id).single(),
    supabase.from('submissions').select('code_content').eq('id', session.submission_id).single(),
    supabase.from('questions').select('id, content').eq('assignment_id', session.assignment_id).order('id', { ascending: true }),
    supabase.from('messages').select('role, content').eq('session_id', sessionId).order('created_at', { ascending: true })
  ]);

  const formattedQuestions = questionsData.data?.map((q, i) => `${i + 1}.[ID:${q.id}]:${q.content}`).join('\n') || '';

  // 3. Token-Dense System Prompt Configuration
  const systemPrompt = `Role: Ora, CS academic interviewer.
Goal: Interactively verify student code comprehension against criteria.

[PROFESSOR INJECTED QUESTIONS]
${formattedQuestions}

[ASSIGNMENT ARCHITECTURE]
${assignmentData.data?.description}

[EVALUATION RUBRIC]
${assignmentData.data?.rubric}

[STUDENT SUBMITTED CODE]
${submissionData.data?.code_content}

[RULES]
1. Step through [PROFESSOR INJECTED QUESTIONS] one at a time fluidly. Do not dump them.
2. Contextualize questions using specific variable names, functions, or blocks in [STUDENT SUBMITTED CODE].
3. Constantly cross-reference evaluation details back to the [EVALUATION RUBRIC].
4. Output Cap: Highly brief. Max 2-3 sentences. State exactly ONE question clearly. Avoid introductory pleasantries or fluff to conserve free-tier tokens.`;

  // Construct context historical array payload
  const historyArray = (historyData.data || []).map(m => ({
    role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
    content: m.content
  }));

  const messagesPayload = [
    { role: 'system' as const, content: systemPrompt },
    ...historyArray
  ];

  // 4. Invoke the stream from our loosely coupled system boundary
  const stream = await streamLLMResponse(messagesPayload, { maxTokens: 150 });

  // 5. Expose stream natively using standard event headers
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

### Task 4: Developer Tool Utility Tracker Hook
**Objective:** Enable a toggleable monitoring metric overlay on Garv’s frontend Chat UI so that developers can check execution latencies and provider routing during internal testing.

#### Specifications:
*   Add a developer toggle header handler to `/api/chat/route.ts`.
*   When an `X-Developer-Mode: true` header is detected, calculate execution latencies on the fly.
*   Expose telemetry markers to the frontend developer tool drawer through custom stream metadata frames or performance tracking response headers.

```typescript
// Insert performance calculation flags surrounding the stream invitation
const startMarker = Date.now();
// ... streaming invocation executes here ...
const endMarker = Date.now();

// Expose calculation feedback dynamically via standard performance context headers
const telemetryHeaders = new Headers({
  'Content-Type': 'text/event-stream',
  'X-Dev-Model': process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  'X-Dev-Latency-Ms': (endMarker - startMarker).toString()
});
```

---

### Task 5: Report Generation & Automated Scoring Endpoint
**Objective:** Build out the `/api/reports/generate` route. Once the interview terminates, the route evaluates the text transcript against the rubric, compiles a structured summary mapping directly to the rubric sections, and saves an advisory score.

#### Specifications:
*   Inject instructions forcing a strict JSON data layout.
*   Save the output structure securely into the relational Postgres `reports` table.

```typescript
// src/app/api/reports/generate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Server component cookie database hook
import { streamOpenRouter } from '@/lib/llm/providers/openrouter';

// Helper to convert readable stream text chunks to a flat string
async function readStreamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { sessionId } = await request.json();

  // Hydrate full transcript and scoring requirements
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  const { data: assignment } = await supabase.from('assignments').select('rubric').eq('id', session.assignment_id).single();
  const { data: messages } = await supabase.from('messages').select('role, content').eq('session_id', sessionId).order('created_at', { ascending: true });

  const transcriptSummary = messages?.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') || '';

  const reportPrompt = `You are a grading assistant analyzing an interview transcript for a CS assignment.
Compare the chat record carefully against the assignment grading criteria.

[RUBRIC CRITERIA]
${assignment.rubric}

[STUDENT TRANSCRIPT]
${transcriptSummary}

[OUTPUT FORMAT]
You must respond with a single, valid JSON object matching this schema exactly. Do not output markdown codeblock tags.
{
  "summary": "High-level description of conversational capability.",
  "rubricAlignment": "Section-by-section breakdown matching criteria points.",
  "strengths": ["List of competencies verified by coding choices.", "Second strength item"],
  "weaknesses": ["List of misconceptions or skipped elements.", "Second weakness item"],
  "suggestedScore": 90
}`;

  // Call provider using high token capacity limits with a low temperature for grading stability
  const stream = await streamOpenRouter([
    { role: 'system', content: 'You are a precise JSON compiler. Output only valid raw JSON matching the schema.' },
    { role: 'user', content: reportPrompt }
  ], { temperature: 0.0, maxTokens: 1200 });

  const rawJsonString = await readStreamToString(stream);
  const jsonOutput = JSON.parse(rawJsonString.trim());

  // Commit evaluated structure back to relational schema
  const { data: savedReport } = await supabase.from('reports').insert({
    session_id: sessionId,
    summary: jsonOutput.summary,
    rubric_alignment: jsonOutput.rubricAlignment,
    strengths: jsonOutput.strengths,
    weaknesses: jsonOutput.weaknesses,
    suggested_score: jsonOutput.suggestedScore
  }).select().single();

  return NextResponse.json({ success: true, report: savedReport });
}
```

---

## Final Verification Checklist for Coding Agent

Before declaring the implementation task complete, verify that the codebase explicitly satisfies the following guardrails:

*   [ ] **Zero Client Leaks:** Ensure no private OpenRouter parameters or token endpoints are hardcoded inside folders or files containing `"use client"` directives.
*   [ ] **Strict Context Continuity:** Confirm that `messagesPayload` appends the full historical database conversation array in strict sequential order.
*   [ ] **Token Boundary Enforcement:** Check that every streaming API execution enforces an upper bounding limit (`max_tokens`) to safeguard token allocations on the free tier.
