# Ora — Claude Code Context

## What is Ora

AI-powered comprehension check web app for UW CS courses. Instructors can't verify student understanding from code submissions alone — manual oral check-ins don't scale beyond ~40 students. Ora automates a structured AI text-chat session per student and produces a graded report for the TA/professor.

**Privacy constraint:** Transcripts are not used to train AI models or for any purpose other than grading.

**Humans stay in the loop:** Ora suggests a score, but the final grade is always made by the instructor or TA.

---

## Three-Phase Flow

1. **Professor setup** — uploads assignment description, rubric, and guiding questions
2. **Student session** — submits code, has a live AI text-chat comprehension interview
3. **TA/professor review** — reads auto-generated transcript report with AI-suggested score, makes final grade

---

## Tech Stack

- **Database / Auth / Storage / Realtime:** Supabase (Postgres)
  - Chosen over Firebase because the data model is relational (assignments → rubrics → questions → submissions → sessions → transcripts → reports) and Supabase Row-Level Security handles multi-tenant access cleanly (professors see only their students, students see only their own sessions)
- **AI:** Claude API (Anthropic) — conversational interview, question generation, report generation

---

## Milestone Roadmap

| # | Milestone | Deliverables |
|---|-----------|--------------|
| 1 | Planning & Setup | GitHub repo, tech stack, DB schema, proposal |
| 2 | Professor Assignment Setup | Instructor-facing form (description, rubric, questions) |
| 3 | Student Walkthrough MVP | Code upload/paste, AI questions, response interface |
| 4 | AI Report Generation | Transcript summary, rubric alignment, suggested score |
| 5 | Testing Phase | QA with real CS assignments |
| 6 | Final Deployment | Deployed app, public site, final presentation |
