"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function startSession(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: latestSubmission } = await supabase
    .from("submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSubmission) {
    const { data: existingSession } = await supabase
      .from("sessions")
      .select("id, status")
      .eq("submission_id", latestSubmission.id)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (existingSession && existingSession.status !== "completed") {
      redirect(`/student/session/${existingSession.id}`);
    }
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      student_id: user.id,
      code: "",
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    throw new Error(submissionError?.message ?? "Failed to create submission");
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      submission_id: submission.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Failed to create session");
  }

  redirect(`/student/session/${session.id}`);
}

export async function completeSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/student/session/${sessionId}/complete`);
}
