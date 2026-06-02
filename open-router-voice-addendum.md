# Addendum Plan: ElevenLabs Voice Transcription Backend Integration for Ora

This addendum outlines the backend modifications required for the `/api/chat` route to ingest, store, and utilize student voice transcripts processed via the ElevenLabs API. Pass this directly to your backend coding agent to extend the existing architecture.

---

## Technical Architecture & Flow

When a student uses the voice tool on Garv's frontend UI, the recording is transcribed via ElevenLabs. The resulting text, along with any highlighted code snippet metadata, is sent to the `/api/chat` route. The backend must process, log, and structure this data so that the LLM (`nvidia/nemotron-3-super-120b-a12b:free`) can explicitly differentiate between standard chat text and verbal code explanations.

```
[Frontend UI (Garv)] 
       │ 
       ├── Audio Recording ──> [ElevenLabs API] ──> Transcription Text
       │ 
       └── POST Payload (Transcription + Annotated Snippet) ──> [/api/chat (Neil)]
```

---

## Technical Implementation: Updating `src/app/api/chat/route.ts`

Modify the POST handler to parse optional voice payloads (`voiceTranscription` and `associatedCodeSnippet`) forwarded from the frontend execution boundary.

```typescript
// src/app/api/chat/route.ts (Addendum Modification)
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamLLMResponse } from '@/lib/llm/gateway';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  // Destructure optional ElevenLabs voice metadata alongside standard message fields
  const { 
    sessionId, 
    studentMessage, 
    voiceTranscription, 
    associatedCodeSnippet 
  } = await request.json();

  // 1. Process and format incoming user data for DB storage and context tracking
  let userPayloadToStore = "";
  
  if (voiceTranscription) {
    // If an ElevenLabs voice transcript is provided, structure it with code metadata
    userPayloadToStore = `[VOICE OVER AUDIO TRANSCRIPTION]: "${voiceTranscription}"`;
    if (associatedCodeSnippet) {
      userPayloadToStore += `\n[ANNOTATED CODE SNIPPET]:\n${associatedCodeSnippet}`;
    }
  } else {
    userPayloadToStore = studentMessage;
  }

  // Persist the formatted payload directly to the messages historical stream
  if (userPayloadToStore) {
    await supabase.from('messages').insert({ 
      session_id: sessionId, 
      role: 'student', 
      content: userPayloadToStore 
    });
  }

  // 2. Hydrate multi-table database context (Retain existing token-optimized logic)
  const { data: session } = await supabase.from('sessions').select('assignment_id, submission_id').eq('id', sessionId).single();
  
  const [assignmentData, submissionData, questionsData, historyData] = await Promise.all([
    supabase.from('assignments').select('description, rubric').eq('id', session.assignment_id).single(),
    supabase.from('submissions').select('code_content').eq('id', session.submission_id).single(),
    supabase.from('questions').select('id, content').eq('assignment_id', session.assignment_id).order('id', { ascending: true }),
    supabase.from('messages').select('role, content').eq('session_id', sessionId).order('created_at', { ascending: true })
  ]);

  const formattedQuestions = questionsData.data?.map((q, i) => `${i + 1}.[ID:${q.id}]:${q.content}`).join('\n') || '';

  // 3. System Prompt Adaptations for Audio-Context Comprehension
  const systemPrompt = `Role: Ora, CS academic interviewer.
Goal: Interactively verify student code comprehension against criteria.

[PROFESSOR INJECTED QUESTIONS]
${formattedQuestions}

[ASSIGNMENT ARCHITECTURE]
${assignmentData.data?.description}

[EVALUATION RUBRIC]
${assignmentData.data?.rubric}

[FULL STUDENT SUBMITTED CODE BASE]
${submissionData.data?.code_content}

[RULES]
1. Step through [PROFESSOR INJECTED QUESTIONS] one at a time fluidly.
2. Note on Student Inputs: The student may provide input via standard text or by recording voice memos. Audio voice messages are explicitly labeled as [VOICE OVER AUDIO TRANSCRIPTION].
3. When evaluating a [VOICE OVER AUDIO TRANSCRIPTION], check if it references a specific [ANNOTATED CODE SNIPPET]. Cross-reference their spoken logic against the actual code implementations inside the [FULL STUDENT SUBMITTED CODE BASE].
4. Address any discrepancies between what they say in their audio transcription and how their code actually executes.
5. Output Cap: Max 2-3 sentences. State exactly ONE question clearly. Avoid filler to save free-tier tokens.`;

  // Build sequential dialog stream
  const historyArray = (historyData.data || []).map(m => ({
    role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
    content: m.content
  }));

  const messagesPayload = [
    { role: 'system' as const, content: systemPrompt },
    ...historyArray
  ];

  // 4. Stream response using our loosely coupled LLM Switchboard
  const stream = await streamLLMResponse(messagesPayload, { maxTokens: 150 });

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

## Verification Requirements for the Coding Agent

Ensure the agent checks the following after modifying the route:
* **Payload Robustness:** The route must gracefully handle cases where `studentMessage` is blank but `voiceTranscription` is populated (and vice versa).
* **Database Alignment:** The combined string containing the transcription text and annotated snippet block must be written cleanly to the `content` field without violating database constraints.
* **Prompt Isolation:** Validate that the system prompt strictly instructs the model to differentiate between conversational chat text and verbal code explanations.
