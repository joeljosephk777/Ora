"use server";

import { generateAndSaveReport } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function generateReportAction(assignmentId: string, sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await generateAndSaveReport(supabase, sessionId);

  revalidatePath(`/professor/assignments/${assignmentId}/reports`);
  revalidatePath(`/professor/assignments/${assignmentId}/reports/${sessionId}`);
  redirect(`/professor/assignments/${assignmentId}/reports/${sessionId}`);
}

export async function generateReportActionForBasePath(
  basePath: "professor" | "ta",
  assignmentId: string,
  sessionId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await generateAndSaveReport(supabase, sessionId);

  revalidatePath(`/${basePath}/assignments/${assignmentId}/reports`);
  revalidatePath(`/${basePath}/assignments/${assignmentId}/reports/${sessionId}`);
  redirect(`/${basePath}/assignments/${assignmentId}/reports/${sessionId}`);
}

export async function saveFinalScoreAction(assignmentId: string, sessionId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawScore = (formData.get("finalScore") as string | null)?.trim() ?? "";
  const finalScore = rawScore ? Number(rawScore) : null;

  if (
    rawScore &&
    (finalScore === null || Number.isNaN(finalScore) || finalScore < 0 || finalScore > 100)
  ) {
    throw new Error("Final score must be a number between 0 and 100.");
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "Generate a report before setting a final score.");
  }

  const { error } = await supabase
    .from("reports")
    .update({
      final_score: finalScore,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", report.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/professor/assignments/${assignmentId}/reports`);
  revalidatePath(`/professor/assignments/${assignmentId}/reports/${sessionId}`);
  redirect(`/professor/assignments/${assignmentId}/reports/${sessionId}`);
}

export async function saveFinalScoreActionForBasePath(
  basePath: "professor" | "ta",
  assignmentId: string,
  sessionId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawScore = (formData.get("finalScore") as string | null)?.trim() ?? "";
  const finalScore = rawScore ? Number(rawScore) : null;

  if (
    rawScore &&
    (finalScore === null || Number.isNaN(finalScore) || finalScore < 0 || finalScore > 100)
  ) {
    throw new Error("Final score must be a number between 0 and 100.");
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "Generate a report before setting a final score.");
  }

  const { error } = await supabase
    .from("reports")
    .update({
      final_score: finalScore,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", report.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/${basePath}/assignments/${assignmentId}/reports`);
  revalidatePath(`/${basePath}/assignments/${assignmentId}/reports/${sessionId}`);
  redirect(`/${basePath}/assignments/${assignmentId}/reports/${sessionId}`);
}
