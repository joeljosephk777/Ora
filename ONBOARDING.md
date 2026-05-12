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
│   ├── app/                  # Next.js App Router pages
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/           # Shared UI components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts     # Browser Supabase client
│   │   │   └── server.ts     # Server Supabase client (uses cookies)
│   │   └── anthropic.ts      # Anthropic client singleton
│   └── types/
│       └── database.ts       # TypeScript types for all DB tables
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Full DB schema + RLS policies
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

## Milestone Roadmap

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Planning & Setup — repo, tech stack, DB schema | **Done** |
| 2 | Professor Assignment Setup — create/edit assignments form | Next up |
| 3 | Student Walkthrough MVP — code upload + AI interview UI | — |
| 4 | AI Report Generation — transcript summary, rubric alignment, score | — |
| 5 | Testing — QA with real CS assignments | — |
| 6 | Final Deployment — Vercel, public site, presentation | — |

---

## Conventions

- **Server vs client components:** Default to Server Components. Add `"use client"` only when you need interactivity or browser APIs.
- **Supabase queries:** Always go through the typed client (`createClient`) so TypeScript catches column name mistakes.
- **No comments explaining what code does** — use clear names instead. Comments only for non-obvious *why*.
- **No AI keys in code** — all secrets through `.env.local` only.

---

## Questions?

Open an issue on GitHub or reach out to Joel.
