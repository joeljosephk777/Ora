# Ora — Contributor Onboarding

AI-powered comprehension checks for UW CS courses. Instructors can't reliably verify student understanding from code submissions alone — Ora automates a structured AI interview per student and produces a graded report for the TA/professor to review.

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Supabase account (free tier is fine) → [supabase.com](https://supabase.com)
- An Anthropic API key → [console.anthropic.com](https://console.anthropic.com)

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
ANTHROPIC_API_KEY=             # console.anthropic.com
```

### 3. Run the database migration
1. Go to your Supabase project → **SQL Editor**
2. Paste the contents of `supabase/migrations/001_initial_schema.sql` and run it
3. This creates all tables, enums, RLS policies, and the auto-profile trigger

### 4. Start the dev server
```bash
npm run dev
```
App runs at [http://localhost:3000](http://localhost:3000)

---

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Framework | Next.js 16 (App Router) | Full-stack, deploys on Vercel, great Supabase integration |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Database / Auth / Storage | Supabase (Postgres) | Relational data model + Row-Level Security for multi-tenant access |
| AI | Anthropic Claude API | Conversational interview, question generation, report generation |
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
│   │   └── anthropic.ts         # Anthropic client singleton
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
2. **Student session** — student receives a link, submits their code, completes an AI text-chat comprehension interview
3. **TA/professor review** — reads an auto-generated transcript report, sets the final grade

**Privacy rule:** Transcripts are used for grading only — never for AI training or any other purpose.
**Grading rule:** Ora suggests a score, the human always makes the final call.

---

## Team & Task Assignments

The project is split into three independent tracks. Each person works on their own branch and opens a PR to `main` when their feature is ready. **Do not touch other people's areas.**

---

### Joel — Auth + Professor Setup
**Branch:** `joel`

Build the foundation that Garv and Neil's work depends on.

- Login / signup pages with role selection (professor or student)
- Auth middleware to protect routes
- Professor dashboard (`/professor/dashboard`)
- Assignment creation form (`/professor/assignments/new`) — title, description, rubric, guiding questions
- Assignment list + edit/delete

**Pages built:**
```
src/app/(auth)/login/page.tsx
src/app/(auth)/signup/page.tsx
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
  - Mark the session as completed
  - Show a confirmation screen after the interview is finished
  - Provide a clear next-step message so students know what happens after submission

**Pages to build:**
```
src/app/(student)/dashboard/page.tsx
src/app/(student)/session/[id]/page.tsx
src/app/(student)/session/[id]/complete/page.tsx
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

- `/api/chat` route — takes session ID + student message, calls Claude, returns AI response, saves both messages to DB
- `/api/reports/generate` route — takes session ID, generates full report (summary, rubric alignment, strengths/weaknesses, suggested score), saves to DB
- Professor report review page (read transcript, set final score)
- TA report review page (same as professor view)

**Files to build:**
```
src/app/api/chat/route.ts
src/app/api/reports/generate/route.ts
src/app/(professor)/assignments/[id]/reports/page.tsx
src/app/(professor)/assignments/[id]/reports/[sessionId]/page.tsx
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
| 3 | Student Walkthrough MVP — code upload + AI interview UI | Garv | — |
| 4 | AI Report Generation — backend + grading UI | Neil | — |
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

Also update the **Caffeine Consumed** table at the top of `CHANGELOG.md` with your coffees and energy drinks. Just for fun.

---

## Questions?

Open an issue on GitHub or reach out to Joel.
