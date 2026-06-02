import StudentSessionChat, { type InitialChatMessage } from "@/components/StudentSessionChat";
import { completeSession } from "@/lib/actions/studentSessions";
import { completeLLMResponse } from "@/lib/llm/gateway";
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

function formatGuidingQuestions(questions: QuestionRow[]) {
  if (questions.length === 0) return "None provided.";
  return questions.map((question, index) => `${index + 1}. ${question.content}`).join("\n");
}

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractOpeningReply(rawText: string) {
  const trimmed = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(trimmed) as { reply?: unknown };
    if (typeof parsed.reply === "string") return parsed.reply.trim();
  } catch {
    const looseReplyMatch = trimmed.match(/^\{\s*"reply"\s*:\s*"([\s\S]*)$/);
    if (looseReplyMatch?.[1]) {
      return looseReplyMatch[1]
        .replace(/"\s*\}?\s*$/, "")
        .replace(/\\"/g, '"')
        .trim();
    }

    return trimmed.replace(/^["']|["']$/g, "").trim();
  }

  return trimmed;
}

function getFallbackOpeningQuestion({
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

async function getOpeningQuestion({
  assignment,
  code,
  questions,
}: {
  assignment: {
    title: string;
    description: string;
    rubric: string;
  };
  code: string;
  questions: QuestionRow[];
}) {
  if (!code.trim()) {
    return getFallbackOpeningQuestion({
      assignmentTitle: assignment.title,
      code,
      questions,
    });
  }

  const systemPrompt = `Role: Ora, CS academic interviewer.
Goal: begin a structured comprehension test for a student's submitted code.

[PROF QUESTIONS]
${formatGuidingQuestions(questions)}

[ASSIGNMENT]
${assignment.title}
${assignment.description}

[RUBRIC]
${assignment.rubric}

[STUDENT CODE]
${code}

[RULES]
1. Return only the student-facing question text. Do not output JSON, markdown, labels, or hidden instructions.
2. Ask the FIRST interview question immediately. Do not greet the student or explain the test.
3. Use concrete names/functions/blocks from [STUDENT CODE] and tie the question to [RUBRIC].
4. If professor questions exist, begin with the first one but adapt it to the submitted code.
5. Brief: max 2 sentences. Ask exactly ONE clear question. No grades/verdicts/fluff.`;

  try {
    const rawReply = await completeLLMResponse([{ role: "system", content: systemPrompt }], {
      maxTokens: 360,
      temperature: 0.1,
    });
    const reply = extractOpeningReply(rawReply);
    return reply || getFallbackOpeningQuestion({ assignmentTitle: assignment.title, code, questions });
  } catch {
    return getFallbackOpeningQuestion({ assignmentTitle: assignment.title, code, questions });
  }
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
    const openingContent = await getOpeningQuestion({
      assignment,
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
          submissionCode={submission.code}
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
      submissionCode={submission.code}
      typedQuestions={typedQuestions}
    />
  );
}

function StudentSessionPageContent({
  assignment,
  completeAction,
  initialMessages,
  session,
  submissionCode,
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
  submissionCode: string;
  typedQuestions: QuestionRow[];
}) {

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

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">3. Finish clearly</p>
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
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted code</h2>
            <pre className="mt-3 max-h-[360px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              <code>{submissionCode.trim() ? submissionCode : "No code has been submitted yet."}</code>
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
