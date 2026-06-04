# Ora — Contributor Onboarding

AI-powered comprehension checks for UW CS courses. Instructors can't reliably verify student understanding from code submissions alone — Ora automates a structured AI interview per student and produces a graded report for the TA/professor to review.

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Supabase account (free tier is fine) → [supabase.com](https://supabase.com)
- An OpenRouter API key → [openrouter.ai](https://openrouter.ai)
- An ElevenLabs API key for voice transcription → [elevenlabs.io](https://elevenlabs.io)

### 1. Clone and install
```bash
git clone https://github.com/joeljosephk777/Ora.git
cd Ora
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```
Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=      # Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Settings → API → anon/public key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
UW_AUTH_DOMAINS=uw.edu,u.washington.edu
PROFESSOR_EMAIL_ALLOWLIST=     # optional comma-separated UW professor emails
OPENROUTER_API_KEY=            # openrouter.ai
OPENROUTER_MODEL=              # optional; defaults to nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
LLM_PROVIDER=openrouter        # optional; defaults to openrouter
ELEVENLABS_API_KEY=            # elevenlabs.io, used by /api/transcribe and usage telemetry
```

### 3. Configure Google auth
1. In Google Cloud Console, create an OAuth client for a web app
2. Add your Supabase callback URL as an authorized redirect URI:
   `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
3. In Supabase Auth -> Providers -> Google, enable Google and paste the Google client ID/secret
4. In Supabase Auth -> URL Configuration, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - your production `/auth/callback` URL when deployed

Ora sends Google the `hd=uw.edu` hint, but that is only a sign-in hint. The app still blocks non-UW accounts in `/auth/callback` and middleware using `UW_AUTH_DOMAINS`.

### 4. Run the database migration
1. Go to your Supabase project → **SQL Editor**
2. Paste the contents of `supabase/migrations/001_initial_schema.sql` and run it
3. This creates all tables, enums, RLS policies, and the auto-profile trigger

### 5. Start the dev server
```bash
npm run dev
```
App runs at [http://localhost:3000](http://localhost:3000)

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Framework | Next.js 16 (App Router) | Full-stack, deploys on Vercel, great Supabase integration |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Database / Auth / Storage | Supabase (Postgres) | Relational data model + Row-Level Security for multi-tenant access |
| AI | OpenRouter LLM gateway | Conversational interview streaming, provider routing, report generation |
| Language | TypeScript | Strict mode enabled throughout |

---

## Project Structure

```
Ora/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login/signup pages (no URL prefix)
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (professor)/      # Professor routes under /professor/*
│   │   │   └── professor/
│   │   │       ├── dashboard/page.tsx
│   │   │       └── assignments/
│   │   │           ├── new/page.tsx
│   │   │           └── [id]/
│   │   │               ├── page.tsx
│   │   │               └── edit/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── AssignmentForm.tsx   # Create/edit form with dynamic questions
│   │   └── DeleteButton.tsx     # Client component for confirm-then-delete
│   ├── lib/
│   │   ├── actions/
│   │   │   ├── auth.ts          # signIn, signUp, signOut server actions
│   │   │   └── assignments.ts   # createAssignment, updateAssignment, deleteAssignment
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser Supabase client
│   │   │   └── server.ts        # Server Supabase client (reads auth from cookies)
│   │   └── llm/                 # Provider-neutral LLM gateway + OpenRouter driver
│   ├── proxy.ts                 # Route protection middleware (Next.js 16)
│   └── types/
│       └── database.ts          # TypeScript types for all DB tables
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Full DB schema + RLS policies
│   └── reset.sql                    # Wipes all tables/enums — run before re-migrating
├── .env.example              # Env template (safe to commit)
├── .env.local                # Your secrets (gitignored — never commit this)
├── CLAUDE.md                 # Context for AI coding assistants
└── ONBOARDING.md             # This file
```

---

## Database Schema

Seven tables, all with Row-Level Security enabled:

```
profiles       — one row per user (professor | ta | student)
assignments    — created by professors (title, description, rubric)
questions      — guiding questions attached to an assignment
submissions    — student code submitted for an assignment
sessions       — the AI interview session for a submission
messages       — individual turns in a session (role: ai | student)
reports        — AI-generated report per session (suggested + final score)
```

**Access rules in plain English:**
- Professors see only their own assignments, submissions, and reports
- Students see only their own submissions, sessions, and messages
- TAs have read access across everything, and can set final scores
- Profiles are auto-created on signup via a Postgres trigger

The full SQL (tables + RLS) is in `supabase/migrations/001_initial_schema.sql`.

---

## How Supabase clients work

Use the **server client** in Server Components and API routes (it reads auth from cookies):
```ts
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
```

Use the **browser client** in Client Components:
```ts
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

---

## Three-Phase App Flow

Understanding this is key before building any feature:

1. **Professor setup** — professor logs in, creates an assignment with a description, rubric, and guiding questions
2. **Student session** — student receives a link, submits code, answers Ora's guided interview, then submits only after Ora says the interview is complete
3. **TA/professor review** — reads an automatically generated transcript report with suggested scoring, then sets the final grade

**Privacy rule:** Transcripts are used for grading only — never for AI training or any other purpose.
**Grading rule:** Ora suggests a score, the human always makes the final call.

---

## Team & Task Assignments

The project is split into three independent tracks. Each person works on their own branch and opens a PR to `main` when their feature is ready. **Do not touch other people's areas.**

---

### Joel — Auth + Professor Setup
**Branch:** `joel`

Build the foundation that Garv and Neil's work depends on.

- Google-only UW sign-in through Supabase OAuth
- Post-login role selection (student or professor)
- Professor access allowlist through `PROFESSOR_EMAIL_ALLOWLIST`
- Auth middleware to protect routes
- Professor dashboard (`/professor/dashboard`)
- Assignment creation form (`/professor/assignments/new`) — title, description, rubric, guiding questions
- Assignment list + edit/delete

**Pages built:**
```
src/app/(auth)/login/page.tsx
src/app/(auth)/signup/page.tsx
src/app/(auth)/role/page.tsx
src/app/auth/callback/route.ts
src/components/RoleSelectionForm.tsx
src/lib/auth/rules.ts
src/app/(professor)/professor/dashboard/page.tsx
src/app/(professor)/professor/assignments/new/page.tsx
src/app/(professor)/professor/assignments/[id]/page.tsx
src/app/(professor)/professor/assignments/[id]/edit/page.tsx
src/components/AssignmentForm.tsx
src/components/DeleteButton.tsx
src/lib/actions/auth.ts
src/lib/actions/assignments.ts
src/proxy.ts
```

---

### Garv — Student Session UI
**Branch:** `garv`

**Usability polish completed on `garv`:**
- [x] Shifted the student session screen to a chat-first layout with a contextual right rail for assignment, rubric, and question review.
- [x] Added a more LLM-style conversation experience with clearer empty states, message hierarchy, and in-thread "Ora is responding" feedback.
- [x] Reworked the composer with Enter-to-send, Shift+Enter for new lines, code/voice tools, inline retry handling, and honest "use as draft" behavior instead of misleading transcript editing.
- [x] Polished the surrounding student flow so the dashboard, session, and completion screens feel visually consistent and easier to navigate.
- [x] Updated the chat client to consume `/api/chat` Server-Sent Events so Ora's reply streams into the transcript while the backend saves the final assistant message.
- [x] Added a developer telemetry toggle that sends `X-Developer-Mode: true` and displays provider/model/latency headers for internal AI routing checks.
- [x] Updated voice-note sends to forward `voiceTranscription` separately from typed text and attach pasted code blocks as `associatedCodeSnippet` context for backend prompt isolation.
- [x] Added student dashboard filters for all, not started, active, and completed sessions.
- [x] Removed rubric and guiding questions from the student interview view; students only see the assignment description and their submitted code.
- [x] Moved final submission into the chat footer and unlock it only after Ora sends the completion message.
- [x] Added final score visibility on the student completion screen after professor/TA grading.

The student-facing flow: from receiving a link to completing the AI interview.

- Student dashboard (list of assigned checks)
  - Fetch and display the student's available comprehension checks
  - Show status for each check (not started, in progress, completed)
  - Add entry points to start a new session or resume an existing one
- Live AI chat interface
  - Build the text-chat UI for the Ora AI comprehension interview
  - Send student replies to `/api/chat` and render Ora's response in the transcript
  - Load and display prior chat messages for an in-progress session
  - Allow students to paste code snippets directly into the chat
  - Add an annotation flow where a student can attach a voiceover recording to a pasted code snippet
  - Show recording, attached-snippet, loading, and retry/error states in the UI
- Session complete / thank you screen
  - Mark the session as completed only after Ora finishes the interview
  - Show a confirmation screen after the interview is finished
  - Show the instructor's final score once it has been entered

**Pages to build:**
```
src/app/(student)/student/dashboard/page.tsx
src/app/(student)/student/assignments/[id]/submit/page.tsx
src/app/(student)/student/session/[id]/page.tsx
src/app/(student)/student/session/[id]/complete/page.tsx
```

**Future module (not MVP):** Code submission page
- Create a dedicated page for submitting code before the interview begins
- Support paste-in code and local file upload
- Save the student's code submission to the linked assignment/session flow
- Validate that code is present before continuing to the interview

**Note:** The chat UI calls an API route at `/api/chat` — Neil builds that route. Build the frontend to POST to it and display the response. The MVP chat should be structured so code-snippet attachments and voiceover annotations can later connect to backend support for storing recordings and snippet metadata.

---

### Neil — AI Backend + Reports
**Branch:** `neil`

The AI engine and the reporting/grading interface.

- `src/lib/llm/gateway.ts` + `src/lib/llm/providers/openrouter.ts` — provider-neutral LLM boundary backed by OpenRouter; defaults to `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` and reads credentials from `OPENROUTER_API_KEY`
- `/api/chat` route — takes session ID plus typed text and/or `voiceTranscription`, writes structured `[TEXT CHAT MESSAGE]`, `[VOICE OVER AUDIO TRANSCRIPTION]`, and `[ANNOTATED CODE SNIPPET]` sections immediately, hydrates only needed assignment/submission/question/transcript fields, streams one-question-at-a-time Ora responses over SSE, saves the completed AI reply to DB, and emits developer telemetry headers when requested
- Interview completion guard — Ora asks the first question automatically, follows the professor's guiding questions, sends the exact completion message when done, and only then unlocks the student's final submission
- ElevenLabs transcription support — `/api/transcribe` converts student voice notes into text, and the UI displays usage/credit estimates after recordings
- `/api/reports/generate` route — takes session ID, generates strict JSON via the LLM gateway, maps rubric alignment/strengths/weaknesses/summary into the `reports` table, and saves an advisory suggested score
- Automatic report generation — when a student submits a completed interview, Ora creates or refreshes the report without requiring the professor to click "generate report"
- Report quality guardrails — invalid AI JSON, model planning text, and old generic fallback summaries are rejected; fallback reports now analyze transcript concepts against rubric/guiding questions and include rubric sub-scores
- Professor report review page — read transcript, view concise AI summary/suggested score/rubric alignment, and set final score
- TA report review page — same review flow as professor view

**Files to build:**
```
src/app/api/chat/route.ts
src/app/api/transcribe/route.ts
src/app/api/reports/generate/route.ts
src/app/(professor)/assignments/[id]/reports/page.tsx
src/app/(professor)/assignments/[id]/reports/[sessionId]/page.tsx
src/components/AssignmentReportsView.tsx
src/components/SessionReportDetailView.tsx
src/lib/reports.ts
src/lib/interviewCompletion.ts
```

---

### Branching rules

- Branch off `main`, work on your branch, open a PR when done
- PR needs at least one review before merging
- Pull from `main` regularly to stay in sync: `git pull origin main`
- Never commit directly to `main`

---

## Milestone Roadmap

| # | Milestone | Owner | Status |
|---|-----------|-------|--------|
| 1 | Planning & Setup — repo, tech stack, DB schema | All | **Done** |
| 2 | Auth + Professor Assignment Setup | Joel | **Done** |
| 3 | Student Walkthrough MVP — code upload + AI interview UI | Garv / Neil | **Done** |
| 4 | AI Report Generation — backend + grading UI | Neil | **Done** |
| 5 | Testing — QA with real CS assignments | All | — |
| 6 | Final Deployment — Vercel, public site, presentation | All | — |

---

## Conventions

- **Server vs client components:** Default to Server Components. Add `"use client"` only when you need interactivity or browser APIs.
- **Supabase queries:** Always go through the typed client (`createClient`) so TypeScript catches column name mistakes.
- **No comments explaining what code does** — use clear names instead. Comments only for non-obvious *why*.
- **No AI keys in code** — all secrets through `.env.local` only.

---

## Changelog

We keep a `CHANGELOG.md` in the repo root. When you merge something, add one line:

```
## YYYY-MM-DD
- **Your name** — what you shipped
```

It takes 30 seconds and gives everyone a plain-English view of progress — useful for the final presentation too.

Also update the **Caffeine Consumed** table at the top of `CHANGELOG.md` with your coffees and Red Bulls. Just for fun.

---

## Questions?

Open an issue on GitHub or reach out to Joel.
