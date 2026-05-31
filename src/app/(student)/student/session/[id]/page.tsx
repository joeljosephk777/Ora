import StudentSessionChat, { type InitialChatMessage } from "@/components/StudentSessionChat";
import { completeSession } from "@/lib/actions/studentSessions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type SessionRow = {
  id: string;
  submission_id: string;
  status: "pending" | "in_progress" | "completed";
  started_at: string | null;
  ended_at: string | null;
};

type QuestionRow = {
  id: string;
  content: string;
  order_index: number;
};

type MessageRow = {
  id: string;
  role: "ai" | "student";
  content: string;
  created_at: string;
};

function statusClasses(status: SessionRow["status"]) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "in_progress") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

function statusLabel(status: SessionRow["status"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Ready";
}

export default async function StudentSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, submission_id, status, started_at, ended_at")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, code, submitted_at")
    .eq("id", session.submission_id)
    .maybeSingle();

  if (!submission) notFound();

  if (!submission.code.trim()) {
    redirect(`/student/assignments/${submission.assignment_id}/submit`);
  }

  const [{ data: assignment }, { data: questions }, { data: messages }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, description, rubric")
      .eq("id", submission.assignment_id)
      .maybeSingle(),
    supabase
      .from("questions")
      .select("id, content, order_index")
      .eq("assignment_id", submission.assignment_id)
      .order("order_index"),
    supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("session_id", session.id)
      .order("created_at"),
  ]);

  if (!assignment) notFound();

  const initialMessages: InitialChatMessage[] = ((messages ?? []) as MessageRow[]).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));

  const completeAction = completeSession.bind(null, session.id);
  const typedQuestions = (questions ?? []) as QuestionRow[];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <Link href="/student/dashboard" className="text-sm text-slate-500 transition-colors hover:text-slate-700">
              ← Back to dashboard
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(session.status)}`}>
                {statusLabel(session.status)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {typedQuestions.length} guiding {typedQuestions.length === 1 ? "question" : "questions"}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{assignment.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Treat this like a focused technical walkthrough. Explain the reasoning behind your choices, reference
              concrete parts of your code, and answer one follow-up question at a time.
            </p>
          </div>

          {session.status !== "completed" && (
            <form action={completeAction}>
              <button
                type="submit"
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Complete session
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">1. Explain the approach</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start with the high-level idea, then zoom into the parts of the implementation you know best.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">2. Show your thinking</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Paste snippets or add a voice note when a design tradeoff is easier to explain than to type.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">3. Submit clearly</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              When you are satisfied with the transcript, complete the session to send it for instructor review.
            </p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <StudentSessionChat
          sessionId={session.id}
          initialStatus={session.status}
          initialMessages={initialMessages}
          assignmentTitle={assignment.title}
        />

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.28)] backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Session guide</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <li>Lead with your implementation choices before diving into details.</li>
              <li>Use Enter to send and Shift+Enter when you need a new line in the composer.</li>
              <li>Use the last student message as a draft if you want to rephrase before replying again.</li>
            </ul>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment brief</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{assignment.description}</p>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Rubric focus</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{assignment.rubric}</p>
          </section>

          {typedQuestions.length > 0 && (
            <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Guiding questions</h2>
              <ol className="mt-3 space-y-3">
                {typedQuestions.map((question, index) => (
                  <li key={question.id} className="flex gap-3 text-sm leading-6 text-slate-600">
                    <span className="shrink-0 text-slate-400">{index + 1}.</span>
                    <span>{question.content}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted code</h2>
            <pre className="mt-3 max-h-[360px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              <code>{submission.code}</code>
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
