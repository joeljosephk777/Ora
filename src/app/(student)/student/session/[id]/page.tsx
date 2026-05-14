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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/student/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="mt-1 text-sm text-gray-500">Chat with Ora about your implementation and decisions.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClasses(session.status)}`}>
            {statusLabel(session.status)}
          </span>
          {session.status !== "completed" && (
            <form action={completeAction}>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Complete session
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Assignment</h2>
            <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {assignment.description}
            </p>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Rubric</h2>
            <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {assignment.rubric}
            </p>
          </section>

          {(questions ?? []).length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Guiding questions</h2>
              <ol className="mt-3 space-y-2">
                {(questions as QuestionRow[]).map((question, index) => (
                  <li key={question.id} className="flex gap-3 text-sm text-gray-700">
                    <span className="shrink-0 text-gray-400">{index + 1}.</span>
                    <span>{question.content}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>

        <StudentSessionChat
          sessionId={session.id}
          initialStatus={session.status}
          initialMessages={initialMessages}
          assignmentTitle={assignment.title}
        />
      </div>
    </div>
  );
}
