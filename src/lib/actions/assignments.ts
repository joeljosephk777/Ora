"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AssignmentState = { error?: string } | null;

function extractQuestions(formData: FormData, assignmentId: string) {
  const questions: { assignment_id: string; content: string; order_index: number }[] = [];
  let i = 0;
  while (formData.has(`question_${i}`)) {
    const content = (formData.get(`question_${i}`) as string).trim();
    if (content) questions.push({ assignment_id: assignmentId, content, order_index: i });
    i++;
  }
  return questions;
}

export async function createAssignment(
  prevState: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      professor_id: user.id,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      rubric: formData.get("rubric") as string,
    })
    .select()
    .single();

  if (error || !assignment) return { error: error?.message ?? "Failed to create assignment" };

  const questions = extractQuestions(formData, assignment.id);
  if (questions.length > 0) {
    const { error: qError } = await supabase.from("questions").insert(questions);
    if (qError) return { error: qError.message };
  }

  redirect("/professor/dashboard");
}

export async function updateAssignment(
  id: string,
  prevState: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("assignments")
    .update({
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      rubric: formData.get("rubric") as string,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("professor_id", user.id);

  if (error) return { error: error.message };

  await supabase.from("questions").delete().eq("assignment_id", id);
  const questions = extractQuestions(formData, id);
  if (questions.length > 0) {
    const { error: qError } = await supabase.from("questions").insert(questions);
    if (qError) return { error: qError.message };
  }

  redirect(`/professor/assignments/${id}`);
}

export async function deleteAssignment(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("assignments").delete().eq("id", id).eq("professor_id", user.id);
  redirect("/professor/dashboard");
}
