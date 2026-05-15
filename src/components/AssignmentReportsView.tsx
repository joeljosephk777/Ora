import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ViewerBasePath = "/professor" | "/ta";

type SessionSummary = {
  id: string;
  submission_id: string;
  status: "pending" | "in_progress" | "completed";
  started_at: string | null;
  ended_at: string | null;
};

function formatScore(score: number | null | undefined) {
  return score === null || score === undefined ? "--" : `${score}/100`;
}

function getStatusClasses(status: SessionSummary["status"]) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "in_progress") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

function getStatusLabel(status: SessionSummary["status"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Pending";
}

export default async function AssignmentReportsView({
  assignmentId,
  basePath,
}: {
  assignmentId: string;
  basePath: ViewerBasePath;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) redirect("/login");
  if (profile.role === "student") redirect("/student/dashboard");
  if (basePath === "/professor" && profile.role !== "professor") redirect("/ta/dashboard");
  if (basePath === "/ta" && profile.role !== "ta") redirect("/professor/dashboard");

  const assignmentQuery = supabase
    .from("assignments")
    .select("id, professor_id, title, description, created_at")
    .eq("id", assignmentId);

  const { data: assignment, error: assignmentError } =
    profile.role === "professor"
      ? await assignmentQuery.eq("professor_id", user.id).maybeSingle()
      : await assignmentQuery.maybeSingle();

  if (assignmentError || !assignment) notFound();

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("id, student_id, submitted_at")
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  if (submissionsError) throw new Error(submissionsError.message);

  const submissionIds = (submissions ?? []).map((submission) => submission.id);
  const studentIds = Array.from(new Set((submissions ?? []).map((submission) => submission.student_id)));

  const { data: sessions, error: sessionsError } = submissionIds.length
    ? await supabase
        .from("sessions")
        .select("id, submission_id, status, started_at, ended_at")
        .in("submission_id", submissionIds)
        .order("started_at", { ascending: false, nullsFirst: false })
    : { data: [] as SessionSummary[], error: null };

  if (sessionsError) throw new Error(sessionsError.message);

  const sessionIds = (sessions ?? []).map((session) => session.id);

  const [{ data: reports, error: reportsError }, { data: students, error: studentsError }, { data: messages, error: messagesError }] =
    sessionIds.length > 0
      ? await Promise.all([
          supabase
            .from("reports")
            .select("id, session_id, suggested_score, final_score, created_at")
            .in("session_id", sessionIds)
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("id, email, full_name").in("id", studentIds),
          supabase.from("messages").select("id, session_id").in("session_id", sessionIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (reportsError) throw new Error(reportsError.message);
  if (studentsError) throw new Error(studentsError.message);
  if (messagesError) throw new Error(messagesError.message);

  const studentById = new Map((students ?? []).map((student) => [student.id, student]));
  const latestReportBySessionId = new Map((reports ?? []).map((report) => [report.session_id, report]));
  const messageCountBySessionId = new Map<string, number>();

  for (const message of messages ?? []) {
    messageCountBySessionId.set(message.session_id, (messageCountBySessionId.get(message.session_id) ?? 0) + 1);
  }

  const rows = (sessions ?? []).map((session) => {
    const submission = (submissions ?? []).find((item) => item.id === session.submission_id);
    const student = submission ? studentById.get(submission.student_id) : null;
    const report = latestReportBySessionId.get(session.id) ?? null;

    return {
      session,
      report,
      student,
      submittedAt: submission?.submitted_at ?? null,
      messageCount: messageCountBySessionId.get(session.id) ?? 0,
    };
  });

  const backHref = basePath === "/professor" ? `/professor/assignments/${assignmentId}` : "/ta/dashboard";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-700">
            {basePath === "/professor" ? "Back to assignment" : "Back to dashboard"}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Reports for {assignment.title}</h1>
          <p className="mt-1 text-sm text-gray-500">Review transcripts, suggested scores, and final grading decisions.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-20 text-center">
          <p className="text-sm text-gray-600">No student sessions have been created for this assignment yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ session, report, student, submittedAt, messageCount }) => (
            <Link
              key={session.id}
              href={`${basePath}/assignments/${assignmentId}/reports/${session.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-900">
                      {student?.full_name || student?.email || "Student session"}
                    </h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(session.status)}`}>
                      {getStatusLabel(session.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{student?.email ?? "Student details unavailable"}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>{submittedAt ? `Submitted ${new Date(submittedAt).toLocaleString()}` : "Submission pending"}</span>
                    <span>{messageCount} transcript messages</span>
                    <span>{report ? "Report ready" : "Report not generated yet"}</span>
                  </div>
                </div>

                <div className="grid min-w-[220px] grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{formatScore(report?.suggested_score)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Final</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{formatScore(report?.final_score)}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
