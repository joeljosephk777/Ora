import { saveFinalScoreActionForBasePath } from "@/lib/actions/reports";
import { formatPacificDateTime } from "@/lib/formatDate";
import { generateAndSaveReport, loadSessionReportContext, reportNeedsRegeneration } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ViewerBasePath = "/professor" | "/ta";

type RubricCriterion = {
  criterion: string;
  assessment: string;
  evidence: string;
  score: number | null;
};

function formatScore(score: number | null | undefined) {
  return score === null || score === undefined ? "--" : `${score}/100`;
}

function getStatusClasses(status: "pending" | "in_progress" | "completed") {
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "in_progress") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

function getStatusLabel(status: "pending" | "in_progress" | "completed") {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Pending";
}

function parseRubricAlignment(value: Json | null) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const candidate = item as Record<string, Json>;

      return {
        criterion: typeof candidate.criterion === "string" ? candidate.criterion : "",
        assessment: typeof candidate.assessment === "string" ? candidate.assessment : "",
        evidence: typeof candidate.evidence === "string" ? candidate.evidence : "",
        score: typeof candidate.score === "number" ? candidate.score : null,
      } satisfies RubricCriterion;
    })
    .filter((item): item is RubricCriterion => Boolean(item && item.criterion));
}

export default async function SessionReportDetailView({
  assignmentId,
  sessionId,
  basePath,
}: {
  assignmentId: string;
  sessionId: string;
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

  const assignmentQuery = supabase.from("assignments").select("id").eq("id", assignmentId);

  const { data: assignmentAccess, error: assignmentAccessError } =
    profile.role === "professor"
      ? await assignmentQuery.eq("professor_id", user.id).maybeSingle()
      : await assignmentQuery.maybeSingle();

  if (assignmentAccessError || !assignmentAccess) notFound();

  let context = await loadSessionReportContext(supabase, sessionId);

  if (context.assignment.id !== assignmentId) notFound();

  if (context.session.status === "completed" && reportNeedsRegeneration(context.report)) {
    try {
      const generated = await generateAndSaveReport(supabase, sessionId);
      context = {
        ...generated.context,
        report: generated.report,
      };
    } catch (reportError) {
      console.warn(reportError instanceof Error ? reportError.message : "Failed to generate missing report.");
    }
  }

  const routeBase = basePath.slice(1) as "professor" | "ta";
  const report = context.report;
  const rubricAlignment = parseRubricAlignment(report?.rubric_alignment ?? null);
  const saveFinalScore = saveFinalScoreActionForBasePath.bind(null, routeBase, assignmentId, sessionId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href={`${basePath}/assignments/${assignmentId}/reports`} className="text-sm text-gray-500 hover:text-gray-700">
            Back to reports
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{context.assignment.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {context.studentProfile?.full_name || context.studentProfile?.email || "Student"} transcript and grading review
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(context.session.status)}`}>
            {getStatusLabel(context.session.status)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Transcript</h2>
              <span className="text-xs text-gray-400">{context.messages.length} messages</span>
            </div>

            {context.messages.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No messages have been recorded for this session yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {context.messages.map((message) => {
                  const isStudent = message.role === "student";

                  return (
                    <div
                      key={message.id}
                      className={`rounded-xl border px-4 py-3 ${
                        isStudent
                          ? "border-indigo-200 bg-indigo-50 dark:border-sky-300/35 dark:bg-sky-950/35"
                          : "border-gray-200 bg-gray-50 dark:border-slate-600/60 dark:bg-slate-800/55"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-gray-900">{isStudent ? "Student" : "Ora"}</span>
                        <span className="text-xs text-gray-400">{formatPacificDateTime(message.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                        {message.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Rubric alignment</h2>
            {rubricAlignment.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                {context.session.status === "completed"
                  ? "Report generation is automatic after completion. If this stays empty, the AI provider may still be processing or may have failed."
                  : "Criterion-by-criterion analysis will appear after the student completes the session."}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {rubricAlignment.map((item, index) => (
                  <div key={`${item.criterion}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-medium text-gray-900">{item.criterion}</h3>
                      <span className="text-sm text-gray-500">
                        {formatScore(item.score) === "--" ? "No subscore" : formatScore(item.score)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Discussion summary & understanding
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {report?.summary ??
                (context.session.status === "completed"
                  ? "Report generation is automatic after completion. If this stays empty, the AI provider may still be processing or may have failed."
                  : "The AI summary, strengths, and weaknesses will appear after the student completes the session.")}
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Scoring</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{formatScore(report?.suggested_score)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Final</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{formatScore(report?.final_score)}</p>
              </div>
            </div>

            <form action={saveFinalScore} className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-gray-700" htmlFor="finalScore">
                Final score
              </label>
              <input
                id="finalScore"
                name="finalScore"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={report?.final_score ?? ""}
                disabled={!report}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={!report}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save final score
              </button>
            </form>

            {report?.reviewed_at && (
              <p className="mt-3 text-xs text-gray-400">Last reviewed {formatPacificDateTime(report.reviewed_at)}</p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assignment context</h2>
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <div>
                <h3 className="font-medium text-gray-900">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-gray-600">{context.assignment.description}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Rubric</h3>
                <p className="mt-1 whitespace-pre-wrap text-gray-600">{context.assignment.rubric}</p>
              </div>
              {context.questions.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900">Guiding questions</h3>
                  <ol className="mt-2 space-y-2">
                    {context.questions.map((question, index) => (
                      <li key={question.id} className="flex gap-3 text-gray-600">
                        <span className="shrink-0 text-gray-400">{index + 1}.</span>
                        <span>{question.content}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
