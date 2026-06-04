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

function getOpeningQuestion({
  assignmentTitle,
  code,
  questions,
}: {
  assignmentTitle: string;
  code: string;
  questions: QuestionRow[];
}) {
  if (!code.trim()) {
    return `Before we start the interview, paste a code snippet or implementation related to "${assignmentTitle}" so I can ask about your actual work.`;
  }

  return questions[0]?.content ?? "Start by walking me through the main idea of your implementation.";
}

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

  const typedQuestions = (questions ?? []) as QuestionRow[];
  let typedMessages = (messages ?? []) as MessageRow[];
  let displaySession = session as SessionRow;

  if (typedMessages.length === 0) {
    const openingContent = getOpeningQuestion({
      assignmentTitle: assignment.title,
      code: submission.code,
      questions: typedQuestions,
    });
    const { data: latestMessages } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("session_id", session.id)
      .order("created_at")
      .limit(1);

    typedMessages = (latestMessages ?? []) as MessageRow[];

    if (typedMessages.length > 0) {
      const initialMessages: InitialChatMessage[] = typedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      }));

      const completeAction = completeSession.bind(null, session.id);

      return (
        <StudentSessionPageContent
          assignment={assignment}
          completeAction={completeAction}
          initialMessages={initialMessages}
          session={displaySession}
          typedQuestions={typedQuestions}
        />
      );
    }

    const { data: openingMessage } = await supabase
      .from("messages")
      .insert({
        session_id: session.id,
        role: "ai",
        content: openingContent,
      })
      .select("id, role, content, created_at")
      .single();

    if (openingMessage) {
      typedMessages = [openingMessage as MessageRow];
    }

    if (session.status === "pending") {
      const startedAt = new Date().toISOString();
      const { error: sessionUpdateError } = await supabase
        .from("sessions")
        .update({
          status: "in_progress",
          started_at: startedAt,
        })
        .eq("id", session.id);

      if (!sessionUpdateError) {
        displaySession = {
          ...session,
          status: "in_progress",
          started_at: startedAt,
        };
      }
    }
  }

  const initialMessages: InitialChatMessage[] = typedMessages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));

  const completeAction = completeSession.bind(null, session.id);

  return (
    <StudentSessionPageContent
      assignment={assignment}
      completeAction={completeAction}
      initialMessages={initialMessages}
      session={displaySession}
      typedQuestions={typedQuestions}
    />
  );
}

function StudentSessionPageContent({
  assignment,
  completeAction,
  initialMessages,
  session,
  typedQuestions,
}: {
  assignment: {
    id: string;
    title: string;
    description: string;
    rubric: string;
  };
  completeAction: () => Promise<void>;
  initialMessages: InitialChatMessage[];
  session: SessionRow;
  typedQuestions: QuestionRow[];
}) {

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_18px_60px_-42px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="w-full">
            <Link href="/student/dashboard" className="text-sm text-slate-500 transition-colors hover:text-slate-700">
              ← Back to dashboard
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(session.status)}`}>
                {statusLabel(session.status)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {typedQuestions.length} guiding {typedQuestions.length === 1 ? "question" : "questions"}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-baseline md:gap-4">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{assignment.title}</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assignment brief</p>
            </div>
            <p className="mt-2 w-full whitespace-pre-wrap text-sm leading-6 text-slate-600">{assignment.description}</p>
          </div>
        </div>
      </section>

      <div className="w-full">
        <StudentSessionChat
          sessionId={session.id}
          initialStatus={session.status}
          initialMessages={initialMessages}
          assignmentTitle={assignment.title}
          completeAction={completeAction}
        />
      </div>
    </div>
  );
}
