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

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Session submitted</h1>
        <p className="mt-3 text-sm text-gray-600">
          {assignment.title} has been marked complete and shared for review.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 text-left">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
            <p className="mt-2 text-sm text-gray-800 capitalize">{session.status.replace("_", " ")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed</p>
            <p className="mt-2 text-sm text-gray-800">
              {session.ended_at ? new Date(session.ended_at).toLocaleString() : "Just now"}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/student/dashboard"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to dashboard
          </Link>
          <Link
            href={`/student/session/${session.id}`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View transcript
          </Link>
        </div>
      </div>
    </div>
  );
}
