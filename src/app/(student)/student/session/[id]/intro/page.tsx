import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function StudentSessionIntroPage({
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
    .select("id, submission_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();
  if (session.status === "completed") redirect(`/student/session/${session.id}/complete`);
  if (session.status === "in_progress") redirect(`/student/session/${session.id}`);

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
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
        <Link href="/student/dashboard" className="text-sm text-slate-500 transition-colors hover:text-slate-700">
          Back to dashboard
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Before Ora starts</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{assignment.title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Treat this like a focused technical walkthrough. Explain the reasoning behind your choices, reference
          concrete parts of your code, and answer one follow-up question at a time.
        </p>
      </section>

      <section className="grid gap-3">
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.3)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">1. Explain the approach</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Start with the high-level idea, then zoom into the parts of the implementation you know best.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.3)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">2. Show your thinking</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Paste snippets or add a voice note when a design tradeoff is easier to explain than to type.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.3)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">3. Finish clearly</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            After Ora completes the interview, submit the session to send it for instructor review.
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <Link
          href={`/student/session/${session.id}`}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Continue to Ora chat
        </Link>
      </div>
    </div>
  );
}
