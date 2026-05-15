import { anthropic } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const anthropicModel = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

type ChatRequestBody = {
  sessionId?: string;
  message?: string;
  codeSnippet?: string | null;
  voiceAnnotation?: {
    durationMs?: number;
    mimeType?: string;
  } | null;
};

function extractAnthropicText(content: { type: string; text?: string }[]) {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ message: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "You must be signed in to chat." }, { status: 401 });
    }

    const body = (await request.json()) as ChatRequestBody;
    const sessionId = body.sessionId?.trim();
    const message = body.message?.trim();

    if (!sessionId || !message) {
      return NextResponse.json({ message: "sessionId and message are required." }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, submission_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ message: sessionError?.message ?? "Session not found." }, { status: 404 });
    }

    if (session.status === "completed") {
      return NextResponse.json({ message: "This session has already been completed." }, { status: 409 });
    }

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id, assignment_id, student_id, code")
      .eq("id", session.submission_id)
      .maybeSingle();

    if (submissionError || !submission) {
      return NextResponse.json(
        { message: submissionError?.message ?? "Submission not found for this session." },
        { status: 404 }
      );
    }

    if (submission.student_id !== user.id) {
      return NextResponse.json({ message: "You do not have access to this session." }, { status: 403 });
    }

    const [{ data: assignment, error: assignmentError }, { data: questions, error: questionsError }, { data: priorMessages, error: messagesError }] =
      await Promise.all([
        supabase
          .from("assignments")
          .select("id, title, description, rubric")
          .eq("id", submission.assignment_id)
          .maybeSingle(),
        supabase
          .from("questions")
          .select("content, order_index")
          .eq("assignment_id", submission.assignment_id)
          .order("order_index"),
        supabase
          .from("messages")
          .select("role, content")
          .eq("session_id", sessionId)
          .order("created_at"),
      ]);

    if (assignmentError || !assignment) {
      return NextResponse.json({ message: assignmentError?.message ?? "Assignment not found." }, { status: 404 });
    }

    if (questionsError) {
      return NextResponse.json({ message: questionsError.message }, { status: 500 });
    }

    if (messagesError) {
      return NextResponse.json({ message: messagesError.message }, { status: 500 });
    }

    const voiceNote =
      body.voiceAnnotation && typeof body.voiceAnnotation.durationMs === "number"
        ? `[Voice annotation attached: ${Math.max(1, Math.round(body.voiceAnnotation.durationMs / 1000))}s${body.voiceAnnotation.mimeType ? `, ${body.voiceAnnotation.mimeType}` : ""}]`
        : null;

    const studentMessage = [message, voiceNote].filter(Boolean).join("\n\n");

    const systemPrompt = [
      "You are Ora, an AI interviewer helping instructors verify a student's understanding of their own code.",
      "You are speaking directly to the student in a supportive but rigorous tone.",
      "Ask one focused follow-up question at a time.",
      "Keep replies concise: usually 2 to 4 sentences.",
      "Do not provide grades, scoring, or verdicts.",
      "Use the rubric and guiding questions to probe reasoning, tradeoffs, debugging choices, and code understanding.",
      "If the student mentions code, refer to it concretely.",
    ].join(" ");

    const conversation = [
      {
        role: "user" as const,
        content: [
          `Assignment title: ${assignment.title}`,
          `Assignment description:\n${assignment.description}`,
          `Rubric:\n${assignment.rubric}`,
          `Guiding questions:\n${
            questions && questions.length > 0
              ? questions.map((question, index) => `${index + 1}. ${question.content}`).join("\n")
              : "No guiding questions were provided."
          }`,
          `Student submission:\n${submission.code || "[No code submitted yet in this MVP flow.]"}`,
          "Transcript so far:",
          ...(priorMessages ?? []).map((entry) => `${entry.role === "ai" ? "Ora" : "Student"}: ${entry.content}`),
          `Student: ${studentMessage}`,
          "Respond as Ora with the next message in the interview.",
        ].join("\n\n"),
      },
    ];

    const response = await anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 500,
      temperature: 0.4,
      system: systemPrompt,
      messages: conversation,
    });

    const reply = extractAnthropicText(response.content);

    if (!reply) {
      return NextResponse.json({ message: "Anthropic returned an empty reply." }, { status: 502 });
    }

    const { error: insertError } = await supabase.from("messages").insert([
      {
        session_id: sessionId,
        role: "student",
        content: studentMessage,
      },
      {
        session_id: sessionId,
        role: "ai",
        content: reply,
      },
    ]);

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }

    if (session.status === "pending") {
      await supabase
        .from("sessions")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to process chat message.",
      },
      { status: 500 }
    );
  }
}
