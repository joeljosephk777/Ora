import { completeLLMResponse } from "@/lib/llm/gateway";
import type { Database, Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["submissions"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

type ReportCriterion = {
  criterion: string;
  assessment: string;
  evidence: string;
  score: number | null;
};

type GeneratedReportPayload = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  rubricAlignment: ReportCriterion[];
  suggestedScore: number | null;
};

export type SessionReportContext = {
  session: SessionRow;
  submission: SubmissionRow;
  assignment: AssignmentRow;
  messages: MessageRow[];
  questions: QuestionRow[];
  studentProfile: Pick<ProfileRow, "id" | "email" | "full_name"> | null;
  report: ReportRow | null;
};

function stripCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseGeneratedReport(rawText: string): GeneratedReportPayload {
  const parsed = JSON.parse(stripCodeFence(rawText)) as Partial<GeneratedReportPayload>;

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    weaknesses: Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    rubricAlignment: Array.isArray(parsed.rubricAlignment)
      ? parsed.rubricAlignment
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const candidate = item as Record<string, unknown>;
            return {
              criterion: typeof candidate.criterion === "string" ? candidate.criterion.trim() : "",
              assessment: typeof candidate.assessment === "string" ? candidate.assessment.trim() : "",
              evidence: typeof candidate.evidence === "string" ? candidate.evidence.trim() : "",
              score: typeof candidate.score === "number" ? candidate.score : null,
            } satisfies ReportCriterion;
          })
          .filter(
            (item): item is ReportCriterion =>
              Boolean(item && item.criterion && item.assessment && item.evidence)
          )
      : [],
    suggestedScore: typeof parsed.suggestedScore === "number" ? parsed.suggestedScore : null,
  };
}

function formatReportSummary(report: GeneratedReportPayload) {
  const sections = [report.summary.trim()];

  if (report.strengths.length > 0) {
    sections.push(`Strengths\n${report.strengths.map((item) => `- ${item}`).join("\n")}`);
  }

  if (report.weaknesses.length > 0) {
    sections.push(`Weaknesses\n${report.weaknesses.map((item) => `- ${item}`).join("\n")}`);
  }

  return sections.filter(Boolean).join("\n\n");
}

function formatTranscript(messages: MessageRow[]) {
  return messages
    .map((message) => `${message.role === "ai" ? "Ora" : "Student"}: ${message.content}`)
    .join("\n\n");
}

function formatGuidingQuestions(questions: QuestionRow[]) {
  if (questions.length === 0) return "No guiding questions were provided.";

  return questions
    .sort((a, b) => a.order_index - b.order_index)
    .map((question, index) => `${index + 1}. ${question.content}`)
    .join("\n");
}

function clampScore(score: number | null) {
  if (score === null || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

export async function loadSessionReportContext(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<SessionReportContext> {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, submission_id, status, started_at, ended_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Session not found.");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id, assignment_id, student_id, code, submitted_at")
    .eq("id", session.submission_id)
    .maybeSingle();

  if (submissionError || !submission) {
    throw new Error(submissionError?.message ?? "Submission not found.");
  }

  const [{ data: assignment, error: assignmentError }, { data: messages, error: messagesError }, { data: questions, error: questionsError }, { data: reports, error: reportsError }, { data: studentProfile, error: studentProfileError }] =
    await Promise.all([
      supabase
        .from("assignments")
        .select("id, professor_id, title, description, rubric, created_at, updated_at")
        .eq("id", submission.assignment_id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, session_id, role, content, created_at")
        .eq("session_id", session.id)
        .order("created_at"),
      supabase
        .from("questions")
        .select("id, assignment_id, content, order_index")
        .eq("assignment_id", submission.assignment_id)
        .order("order_index"),
      supabase
        .from("reports")
        .select("id, session_id, summary, rubric_alignment, suggested_score, final_score, reviewed_by, reviewed_at, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", submission.student_id)
        .maybeSingle(),
    ]);

  if (assignmentError || !assignment) {
    throw new Error(assignmentError?.message ?? "Assignment not found.");
  }

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  if (reportsError) {
    throw new Error(reportsError.message);
  }

  if (studentProfileError) {
    throw new Error(studentProfileError.message);
  }

  return {
    session,
    submission,
    assignment,
    messages: messages ?? [],
    questions: questions ?? [],
    report: reports?.[0] ?? null,
    studentProfile,
  };
}

export async function generateAndSaveReport(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const context = await loadSessionReportContext(supabase, sessionId);

  if (context.messages.length === 0) {
    throw new Error("This session has no transcript yet.");
  }

  const systemPrompt = [
    "Role: Ora grading support for CS comprehension interviews.",
    "Return ONLY valid JSON. No markdown, prose, comments, or code fences.",
    "Schema:",
    '{"summary":"string","strengths":["string"],"weaknesses":["string"],"rubricAlignment":[{"criterion":"string","assessment":"string","evidence":"string","score":number|null}],"suggestedScore":number|null}',
    "Rules:",
    "- suggestedScore is 0-100 only when evidence is sufficient.",
    "- rubricAlignment must map directly to rubric criteria where possible.",
    "- Evidence must come from transcript/submission/materials only.",
    "- Keep all fields concise and instructor-readable.",
  ].join("\n");

  const userPrompt = [
    `[ASSIGNMENT]\n${context.assignment.title}\n${context.assignment.description}`,
    `[RUBRIC]\n${context.assignment.rubric}`,
    `[GUIDING QUESTIONS]\n${formatGuidingQuestions(context.questions)}`,
    `[STUDENT CODE]\n${context.submission.code || "[No code was submitted in the MVP flow.]"}`,
    `[TRANSCRIPT]\n${formatTranscript(context.messages)}`,
  ].join("\n\n");

  const responseText = await completeLLMResponse(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    {
      maxTokens: 1400,
      temperature: 0.1,
    }
  );

  if (!responseText) {
    throw new Error("LLM provider returned an empty report.");
  }

  const parsed = parseGeneratedReport(responseText);

  if (!parsed.summary) {
    throw new Error("Generated report did not include a summary.");
  }

  const payload = {
    summary: formatReportSummary(parsed),
    rubric_alignment: parsed.rubricAlignment as Json,
    suggested_score: clampScore(parsed.suggestedScore),
  };

  let savedReport: ReportRow | null = null;

  if (context.report) {
    const { data, error } = await supabase
      .from("reports")
      .update(payload)
      .eq("id", context.report.id)
      .select("id, session_id, summary, rubric_alignment, suggested_score, final_score, reviewed_by, reviewed_at, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update report.");
    }

    savedReport = data;
  } else {
    const { data, error } = await supabase
      .from("reports")
      .insert({
        session_id: sessionId,
        ...payload,
      })
      .select("id, session_id, summary, rubric_alignment, suggested_score, final_score, reviewed_by, reviewed_at, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to save report.");
    }

    savedReport = data;
  }

  return {
    context,
    report: savedReport,
  };
}
