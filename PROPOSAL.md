# Ora — Project Proposal

---

## UW Community Impact Statement

**Problem:** UW CS courses face a growing assessment gap. With AI coding tools widely available, instructors and TAs cannot reliably tell from a submission alone whether a student actually understands the code they turned in. Manual oral check-ins work but don't scale to classes of 40+ students.

**Benefits:**

- **Students** get a chance to explain their own thinking instead of being judged only by code.
- **TAs** get a structured transcript/report instead of needing to manually interview every student.
- **Professors** get better insight into whether students actually understand concepts.
- **The UW CS community** benefits because the tool supports academic integrity without immediately assuming students are cheating.

---

## AI Integration Strategy

Ora meaningfully embeds AI at multiple layers — not as a simple wrapper:

- **Conversational AI (NLP core):** The AI conducts a live chat session with each student, asking comprehension questions tailored to the professor's rubric and guiding questions. Students respond by narrating and walking through their code verbally/in text.
- **Question generation:** Based on the assignment description, rubric, and professor-specified topics, the AI dynamically generates targeted comprehension questions rather than using a fixed script.
- **Transcript analysis & report generation:** After the session, the AI analyzes the full conversation to produce a structured report — including a transcript summary, rubric alignment, identified strengths and weaknesses, and a suggested score.
- **Natural language processing** is central to the pipeline: parsing student responses, evaluating conceptual accuracy, and mapping answers back to rubric criteria.

---

## Repository

[https://github.com/joeljosephk777/Ora](https://github.com/joeljosephk777/Ora)

---

## Milestone Roadmap

| Milestone | Description | Deliverables |
|-----------|-------------|--------------|
| **1 — Planning & Setup** | Project foundation | GitHub repo, tech stack decision, database schema, project proposal |
| **2 — Professor Assignment Setup** | Instructor-facing form | Form for entering assignment description, rubric, and guiding questions |
| **3 — Student Walkthrough MVP** | Core student flow | Code upload/paste, AI-generated comprehension questions, student response interface |
| **4 — AI Report Generation** | Automated grading support | Transcript summary, rubric alignment, strengths/weaknesses, suggested score |
| **5 — Testing Phase** | QA with real assignments | Test with sample CS assignments; fix unclear questions, bad summaries, UI issues |
| **6 — Final Deployment** | Ship it | Deployed app, public project website, polished README, final presentation |
