import { DM_Serif_Display } from "next/font/google";
import Link from "next/link";

const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

function Step({
  n,
  role,
  title,
  description,
  items,
}: {
  n: string;
  role: string;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-slate-200/60 bg-white/75 p-7 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {n}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          {role}
        </span>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8.5l3.5 3.5 6.5-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={`${serif.variable} min-h-screen`}>
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold uppercase tracking-widest text-white">
              Ora
            </span>
            <span className="hidden text-xs text-slate-400 sm:block">for UW CS</span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 active:scale-95"
          >
            Sign in with UW Google
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7h8M8 4l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/70 px-4 py-1.5 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            University of Washington · CSE
          </div>

          <h1
            className="text-5xl leading-[1.1] tracking-tight text-slate-900 sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Know if your students
            <br />
            <span className="text-blue-700">understand</span> their code.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-500">
            Manual oral check-ins don&apos;t scale past 40 students. Ora automates a structured
            AI comprehension interview for every submission — and gives your TAs a graded report
            to review.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-blue-700 px-7 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 active:scale-95"
            >
              Get started with UW Google
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-slate-200 bg-white/80 px-7 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              See how it works ↓
            </a>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-y border-slate-200/50 bg-white/50 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
              <div>
                <p className="text-4xl font-semibold text-slate-900">200+</p>
                <p className="mt-1.5 text-sm text-slate-500">Students per CS section</p>
              </div>
              <div className="border-slate-200 sm:border-x">
                <p className="text-4xl font-semibold text-slate-900">3 roles</p>
                <p className="mt-1.5 text-sm text-slate-500">Professor · TA · Student</p>
              </div>
              <div>
                <p className="text-4xl font-semibold text-slate-900">Human-in-loop</p>
                <p className="mt-1.5 text-sm text-slate-500">AI suggests — instructor grades</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
              Three-phase workflow
            </p>
            <h2
              className="text-3xl text-slate-900 sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              From assignment to graded report
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Step
              n="1"
              role="Professor"
              title="Set up the assignment"
              description="Upload the assignment description, rubric criteria, and guiding questions Ora should probe during the interview."
              items={[
                "Paste assignment description",
                "Define rubric criteria",
                "Add guiding questions",
              ]}
            />
            <Step
              n="2"
              role="Student"
              title="Complete the interview"
              description="Students submit their code, then answer questions from an AI interviewer grounded in their actual submission."
              items={[
                "Paste or upload code",
                "AI asks targeted questions",
                "Optional voice annotation",
              ]}
            />
            <Step
              n="3"
              role="TA / Professor"
              title="Review the report"
              description="Read the auto-generated transcript report with rubric alignment, evidence citations, and a suggested 0–100 score."
              items={[
                "Rubric-aligned summary",
                "Evidence from transcript",
                "Suggested score to review",
              ]}
            />
          </div>
        </section>

        {/* AI callout */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-8 backdrop-blur-sm md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:gap-16">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
                  AI integration
                </p>
                <h3
                  className="text-2xl text-slate-900 sm:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  AI that asks the right questions
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Ora&apos;s interviewer is built on a large language model fine-tuned to probe
                  understanding, not just recall. Every question is grounded in the student&apos;s
                  actual submitted code — so generic answers don&apos;t slip through.
                </p>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
                  Report generation
                </p>
                <h3
                  className="text-2xl text-slate-900 sm:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Reports TAs can actually trust
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  The report maps each rubric criterion to evidence from the transcript — with
                  direct quotes. TAs see why a score was suggested, not just what it is, and
                  always make the final call.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy + tech */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Privacy */}
            <div className="rounded-2xl border border-slate-200/60 bg-white/75 p-7 backdrop-blur-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white">
                <svg className="h-4 w-4 text-slate-700" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 1L2 4v4c0 3.31 2.42 6.41 6 7 3.58-.59 6-3.69 6-7V4L8 1z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Privacy-first by design</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Transcripts are used only for grading — never to train AI models or shared
                outside your course. Authentication is UW Google only, so access stays within
                the university.
              </p>
            </div>

            {/* Tech stack */}
            <div className="rounded-2xl border border-slate-200/60 bg-white/75 p-7 backdrop-blur-sm">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white">
                <svg className="h-4 w-4 text-slate-700" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 4h12M2 8h8M2 12h5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Built on proven infrastructure</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Next.js · TypeScript · Supabase (Postgres + RLS + Auth) · OpenRouter AI ·
                ElevenLabs voice transcription. Relational schema with row-level security keeps
                every student&apos;s data isolated.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-8 py-16 text-center md:px-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(circle at 30% 50%, rgba(59,130,246,0.4), transparent 55%), radial-gradient(circle at 70% 50%, rgba(99,102,241,0.3), transparent 55%)",
              }}
            />
            <div className="relative">
              <h2
                className="text-3xl text-white sm:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Ready to run your first comprehension check?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                Sign in with your UW Google account to get started. Students, TAs, and
                professors all use the same login.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 active:scale-95"
              >
                Sign in with UW Google
                <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest text-white">
              Ora
            </span>
            <span className="text-xs text-slate-400">
              University of Washington · Intro to AI · 2026
            </span>
          </div>
          <p className="text-xs text-slate-400">UW accounts only</p>
        </div>
      </footer>
    </div>
  );
}
