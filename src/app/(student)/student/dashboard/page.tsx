import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type Assignment = {
  id: string;
  title: string;
  description: string;
  created_at: string;
};

type Submission = {
  id: string;
  assignment_id: string;
  submitted_at: string;
};

type Session = {
  id: string;
  submission_id: string;
  status: "pending" | "in_progress" | "completed";
  started_at: string | null;
  ended_at: string | null;
};

function getStatusLabel(status?: Session["status"]) {
  if (!status) return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return "Ready";
}

function getStatusClasses(status?: Session["status"]) {
  if (!status) return "bg-gray-100 text-gray-700";
  if (status === "in_progress") return "bg-amber-100 text-amber-800";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  return "bg-blue-100 text-blue-800";
}

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: assignments }, { data: submissions }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, description, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("submissions")
      .select("id, assignment_id, submitted_at")
      .eq("student_id", user.id)
      .order("submitted_at", { ascending: false }),
  ]);

  const typedAssignments = (assignments ?? []) as Assignment[];
  const typedSubmissions = (submissions ?? []) as Submission[];

  const submissionIds = typedSubmissions.map((submission) => submission.id);

  const { data: sessions } = submissionIds.length
    ? await supabase
        .from("sessions")
        .select("id, submission_id, status, started_at, ended_at")
        .in("submission_id", submissionIds)
    : { data: [] as Session[] };

  const typedSessions = (sessions ?? []) as Session[];

  const latestSessionByAssignment = new Map<string, Session>();
  const sessionsBySubmissionId = new Map<string, Session>();

  for (const session of typedSessions) {
    const current = sessionsBySubmissionId.get(session.submission_id);
    if (!current) {
      sessionsBySubmissionId.set(session.submission_id, session);
      continue;
    }

    const currentTimestamp = current.started_at ?? "";
    const nextTimestamp = session.started_at ?? "";
    if (nextTimestamp > currentTimestamp) {
      sessionsBySubmissionId.set(session.submission_id, session);
    }
  }

  for (const submission of typedSubmissions) {
    if (latestSessionByAssignment.has(submission.assignment_id)) continue;
    const session = sessionsBySubmissionId.get(submission.id);
    if (session) latestSessionByAssignment.set(submission.assignment_id, session);
  }

  const checks = typedAssignments.map((assignment) => ({
    assignment,
    session: latestSessionByAssignment.get(assignment.id),
  }));

  const completedCount = checks.filter(({ session }) => session?.status === "completed").length;
  const activeCount = checks.filter(({ session }) => session?.status === "in_progress").length;
  const readyCount = checks.filter(({ session }) => !session || session.status === "pending").length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Student session hub</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Comprehension checks</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Each check is a short AI-led walkthrough of your implementation. Start when you are ready,
              resume anytime, and submit once you feel your reasoning is clearly explained.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{checks.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Active</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-sm text-slate-600">
          {readyCount} {readyCount === 1 ? "check is" : "checks are"} ready to start. Enter a session with notes,
          tradeoffs, and any code snippets you want to discuss.
        </div>
      </section>

      {checks.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 py-20 text-center shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] backdrop-blur">
          <p className="text-sm text-slate-600">No checks available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {checks.map(({ assignment, session }) => {
            const statusLabel = getStatusLabel(session?.status);
            const actionLabel =
              session?.status === "completed" ? "View complete" : session ? "Resume session" : "Start session";
            const actionHref =
              session?.status === "completed"
                ? `/student/session/${session.id}/complete`
                : session
                  ? `/student/session/${session.id}`
                  : `/student/assignments/${assignment.id}/submit`;
            const helperCopy =
              session?.status === "completed"
                ? "Review your submitted transcript and confirmation details."
                : session?.status === "in_progress"
                  ? "Jump back into the conversation right where you left off."
                  : "Start the interview when you're ready to explain your implementation.";

            return (
              <div
                key={assignment.id}
                className="flex flex-col gap-5 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.28)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Comprehension check
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">{assignment.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{assignment.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(session?.status)}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-600">
                  {helperCopy}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-400">
                    {new Date(assignment.created_at).toLocaleDateString()}
                  </span>
                  <Link
                    href={actionHref}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    {actionLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
