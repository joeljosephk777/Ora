import { startSession } from "@/lib/actions/studentSessions";
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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comprehension checks</h1>
          <p className="mt-1 text-sm text-gray-500">Start a session or pick up where you left off.</p>
        </div>
      </div>

      {checks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-600 text-sm">No checks available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {checks.map(({ assignment, session }) => {
            const startAction = startSession.bind(null, assignment.id);
            const statusLabel = getStatusLabel(session?.status);
            const actionLabel =
              session?.status === "completed" ? "View complete" : session ? "Resume session" : "Start session";
            const actionHref =
              session?.status === "completed"
                ? `/student/session/${session.id}/complete`
                : session
                  ? `/student/session/${session.id}`
                  : null;

            return (
              <div
                key={assignment.id}
                className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">{assignment.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">{assignment.description}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClasses(session?.status)}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-gray-400">
                    {new Date(assignment.created_at).toLocaleDateString()}
                  </span>
                  {actionHref ? (
                    <Link
                      href={actionHref}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      {actionLabel}
                    </Link>
                  ) : (
                    <form action={startAction}>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        {actionLabel}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
