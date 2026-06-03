import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function StudentSessionCompletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, submission_id, status, ended_at")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: submission } = await supabase
    .from("submissions")
    .select("assignment_id")
    .eq("id", session.submission_id)
    .maybeSingle();

  if (!submission) notFound();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("title")
    .eq("id", submission.assignment_id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: report } = await supabase
    .from("reports")
    .select("final_score, reviewed_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex min-h-[72vh] items-center justify-center">
      <div className="w-full max-w-4xl rounded-[2.25rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur sm:p-10">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Submitted
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Session submitted</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            {assignment.title} has been marked complete and shared for review. Your transcript is saved, and your
            instructor can now use it during evaluation.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
            <p className="mt-2 text-sm font-medium capitalize text-slate-900">{session.status.replace("_", " ")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completed</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {session.ended_at ? new Date(session.ended_at).toLocaleString() : "Just now"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Final score</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {report?.final_score === null || report?.final_score === undefined ? "Pending review" : `${report.final_score}/100`}
            </p>
            {report?.reviewed_at && (
              <p className="mt-1 text-xs text-slate-500">Reviewed {new Date(report.reviewed_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">What happens next</h2>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <li>Your session transcript stays available if you want to review what you submitted.</li>
              <li>Your instructor can review the transcript and assign a final score manually.</li>
              <li>Once the final score is saved, it appears on this page.</li>
            </ol>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200/80 bg-slate-50/80 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Quick actions</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/student/dashboard"
                className="rounded-full bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Back to dashboard
              </Link>
              <Link
                href={`/student/session/${session.id}`}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                View transcript
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
