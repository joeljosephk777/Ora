import CodeSubmissionForm from "@/components/CodeSubmissionForm";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function StudentCodeSubmissionPage({
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

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, description, rubric")
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: latestSubmission } = await supabase
    .from("submissions")
    .select("id, code")
    .eq("assignment_id", id)
    .eq("student_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
        <Link href="/student/dashboard" className="text-sm text-slate-500 transition-colors hover:text-slate-700">
          Back to dashboard
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Code submission</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{assignment.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{assignment.description}</p>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CodeSubmissionForm assignmentId={assignment.id} initialCode={latestSubmission?.code ?? ""} />

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Rubric focus</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{assignment.rubric}</p>
          </section>
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">What happens next</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Ora will use this code, the assignment prompt, and the rubric to ask targeted comprehension questions.
              You can still paste smaller snippets during the interview when a specific section needs attention.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
