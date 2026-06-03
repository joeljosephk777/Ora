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

type ReportFallbackContext = Pick<SessionReportContext, "assignment" | "messages" | "questions" | "submission">;

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

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function extractJsonObject(value: string) {
  const stripped = stripCodeFence(value);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return stripped;
  return stripped.slice(start, end + 1);
}

function isModelPlanningText(value: string) {
  return /\bwe need to\b/i.test(value) || /\bmust follow rules\b/i.test(value) || /\boutput JSON\b/i.test(value);
}

function includesInternalFallbackText(value: string) {
  return /\bautomatic report fallback\b/i.test(value) || /\bAI provider did not return valid structured report data\b/i.test(value);
}

function includesGenericFallbackText(value: string) {
  return (
    /\btranscript contains about\b/i.test(value) ||
    /\bresponse completeness and available evidence\b/i.test(value) ||
    /\bResponded to Ora's comprehension prompts\b/i.test(value) ||
    /\bManual review should confirm correctness\b/i.test(value)
  );
}

function hasNoCriterionScores(value: Json | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    return typeof (item as Record<string, Json>).score !== "number";
  });
}

export function reportNeedsRegeneration(
  report: { summary: string | null; suggested_score: number | null; rubric_alignment?: Json | null } | null
) {
  if (!report) return true;
  const summary = report.summary?.trim() ?? "";
  return (
    !summary ||
    report.suggested_score === null ||
    summary.startsWith("{") ||
    isModelPlanningText(summary) ||
    includesInternalFallbackText(summary) ||
    includesGenericFallbackText(summary) ||
    hasNoCriterionScores(report.rubric_alignment)
  );
}

function getStudentMessages(messages: MessageRow[]) {
  return messages.filter((message) => message.role === "student");
}

function getFallbackSuggestedScore(context: ReportFallbackContext) {
  const studentMessages = getStudentMessages(context.messages);
  const transcriptWordCount = studentMessages
    .map((message) => message.content)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  const aiQuestions = context.messages.filter((message) => message.role === "ai").length;
  const expectedQuestions = Math.max(1, context.questions.length);

  let score = 55;
  if (studentMessages.length >= expectedQuestions) score += 15;
  if (studentMessages.length >= Math.ceil(expectedQuestions * 1.5)) score += 5;
  if (transcriptWordCount >= expectedQuestions * 35) score += 15;
  if (transcriptWordCount >= expectedQuestions * 60) score += 5;
  if (context.submission.code.trim().length > 0) score += 5;
  if (aiQuestions > 0 && studentMessages.length === 0) score -= 25;

  return clampScore(score) ?? 60;
}

function getRubricCriteria(context: ReportFallbackContext) {
  const rubricCriteria = context.assignment.rubric
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /:|\d+%|points?/i.test(line))
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/\s+/g, " "));

  if (rubricCriteria.length > 0) return rubricCriteria.slice(0, 5);
  if (context.questions.length > 0) return context.questions.slice(0, 5).map((question) => question.content);
  return ["Overall comprehension", "Code reasoning", "Complexity and edge cases"];
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "answer",
  "assignment",
  "because",
  "before",
  "between",
  "both",
  "check",
  "code",
  "correct",
  "demonstrate",
  "describe",
  "does",
  "each",
  "explain",
  "given",
  "have",
  "implementation",
  "interview",
  "into",
  "need",
  "point",
  "program",
  "question",
  "return",
  "same",
  "should",
  "student",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "understand",
  "understanding",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

const TECHNICAL_CONCEPTS = [
  {
    patterns: ["recursive", "recursion", "base case", "call stack"],
    label: "recursive base cases and control flow",
  },
  {
    patterns: ["null", "nullptr", "none", "empty tree", "leaf"],
    label: "null or empty input handling",
  },
  {
    patterns: ["left", "right", "subtree", "child", "children"],
    label: "left and right subtree comparison",
  },
  {
    patterns: ["value", "val", "data", "equal", "compare"],
    label: "node value comparison",
  },
  {
    patterns: ["hash", "map", "unordered_map", "complement", "lookup"],
    label: "hash-map complement lookup strategy",
  },
  {
    patterns: ["duplicate", "same element", "same index", "distinct"],
    label: "duplicate values and distinct-index constraints",
  },
  {
    patterns: ["o(n)", "linear", "time complexity", "space complexity", "complexity"],
    label: "time and space complexity",
  },
  {
    patterns: ["edge case", "empty", "single", "negative", "zero"],
    label: "edge case handling",
  },
  {
    patterns: ["pointer", "node", "next", "head", "memory", "delete"],
    label: "pointer and node management",
  },
];

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#()]+/g, " ");
}

function getMeaningfulTerms(value: string) {
  const terms = normalizeForMatch(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 || /^o\(.+\)$/.test(term))
    .filter((term) => !STOP_WORDS.has(term))
    .filter((term) => !/^\d+$/.test(term));

  return Array.from(new Set(terms));
}

function getStudentTranscriptText(messages: MessageRow[]) {
  return getStudentMessages(messages)
    .map((message) => message.content)
    .join(" ");
}

function getCoveredTechnicalConcepts(text: string) {
  const lower = normalizeForMatch(text);
  return TECHNICAL_CONCEPTS.filter((concept) =>
    concept.patterns.some((pattern) => lower.includes(normalizeForMatch(pattern).trim()))
  ).map((concept) => concept.label);
}

function getExpectedTechnicalConcepts(context: ReportFallbackContext) {
  const expectedText = `${context.assignment.description}\n${context.assignment.rubric}\n${context.questions
    .map((question) => question.content)
    .join("\n")}`;
  return getCoveredTechnicalConcepts(expectedText);
}

function getCriterionCoverage(criterion: string, studentText: string) {
  const criterionTerms = getMeaningfulTerms(criterion);
  const transcriptTerms = new Set(getMeaningfulTerms(studentText));
  const coveredTerms = criterionTerms.filter((term) => transcriptTerms.has(term));
  const missingTerms = criterionTerms.filter((term) => !transcriptTerms.has(term));
  const coverage = criterionTerms.length > 0 ? coveredTerms.length / criterionTerms.length : 0;

  return {
    coveredTerms,
    missingTerms,
    coverage,
  };
}

function getCriterionScore(coverage: number, studentText: string, hasCode: boolean) {
  const wordCount = studentText.split(/\s+/).filter(Boolean).length;
  const detailBonus = wordCount >= 140 ? 8 : wordCount >= 70 ? 5 : wordCount >= 30 ? 2 : 0;
  const codeBonus = hasCode ? 3 : 0;
  const score = 42 + coverage * 50 + detailBonus + codeBonus;
  return clampScore(score) ?? 55;
}

function cleanCriterionLabel(criterion: string) {
  return compactText(
    criterion
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+[\).:-]\s*/, "")
      .replace(/\s*\(?\d+\s*(?:points?|pts|%)\)?/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
    80
  );
}

function describeCoveredConcepts(concepts: string[], fallbackTerms: string[]) {
  const items = concepts.length > 0 ? concepts : fallbackTerms.slice(0, 4);
  if (items.length === 0) return "limited assignment-specific concepts";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function buildStrengths(coveredConcepts: string[], alignments: ReportCriterion[]) {
  const strongCriteria = alignments.filter((item) => (item.score ?? 0) >= 70).map((item) => item.criterion);
  const strengths = [
    ...coveredConcepts.slice(0, 2).map((concept) => `Showed understanding of ${concept}.`),
    ...strongCriteria.slice(0, 2).map((criterion) => `Addressed ${criterion}.`),
  ];

  return Array.from(new Set(strengths)).slice(0, 3);
}

function buildWeaknesses(missingConcepts: string[], alignments: ReportCriterion[]) {
  const weakCriteria = alignments.filter((item) => (item.score ?? 0) < 70).map((item) => item.criterion);
  const weaknesses = [
    ...missingConcepts.slice(0, 2).map((concept) => `Did not clearly demonstrate ${concept}.`),
    ...weakCriteria.slice(0, 2).map((criterion) => `Needs stronger evidence for ${criterion}.`),
  ];

  return Array.from(new Set(weaknesses)).slice(0, 3);
}

function getAssessmentLabel(score: number) {
  if (score >= 85) return "Strong evidence of understanding from the interview transcript.";
  if (score >= 70) return "Adequate evidence of understanding, with some areas needing review.";
  if (score >= 55) return "Partial evidence of understanding; instructor review should focus on gaps.";
  return "Limited evidence of understanding in the recorded interview.";
}

function normalizeCriterionScore(score: unknown) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  const normalized = score > 0 && score <= 10 ? score * 10 : score;
  return clampScore(normalized);
}

function buildFallbackReport(context: ReportFallbackContext): GeneratedReportPayload {
  const studentText = getStudentTranscriptText(context.messages);
  const hasCode = context.submission.code.trim().length > 0;
  const criteria = getRubricCriteria(context);
  const expectedConcepts = getExpectedTechnicalConcepts(context);
  const coveredConcepts = getCoveredTechnicalConcepts(studentText);
  const missingConcepts = expectedConcepts.filter((concept) => !coveredConcepts.includes(concept));
  const transcriptTerms = getMeaningfulTerms(studentText);
  const rubricAlignment = criteria.map((criterion) => {
    const coverage = getCriterionCoverage(criterion, studentText);
    const criterionConcepts = getCoveredTechnicalConcepts(criterion);
    const coveredCriterionConcepts = criterionConcepts.filter((concept) => coveredConcepts.includes(concept));
    const missingCriterionConcepts = criterionConcepts.filter((concept) => !coveredConcepts.includes(concept));
    const conceptCoverage =
      criterionConcepts.length > 0 ? coveredCriterionConcepts.length / criterionConcepts.length : coverage.coverage;
    const score = getCriterionScore(Math.max(coverage.coverage, conceptCoverage), studentText, hasCode);
    const coveredEvidence = coveredCriterionConcepts.length > 0 ? coveredCriterionConcepts : coverage.coveredTerms;
    const missingEvidence = missingCriterionConcepts.length > 0 ? missingCriterionConcepts : coverage.missingTerms;
    const coveredText = describeCoveredConcepts(coveredEvidence.slice(0, 4), []);
    const missingText = describeCoveredConcepts(missingEvidence.slice(0, 4), []);

    return {
      criterion: cleanCriterionLabel(criterion),
      assessment: compactText(getAssessmentLabel(score), 180),
      evidence: compactText(
        coveredEvidence.length > 0
          ? `Student responses referenced ${coveredText}.`
          : `Transcript did not clearly address ${missingText}.`,
        180
      ),
      score,
    };
  });
  const averageScore =
    rubricAlignment.length > 0
      ? rubricAlignment.reduce((total, item) => total + (item.score ?? 0), 0) / rubricAlignment.length
      : getFallbackSuggestedScore(context);
  const suggestedScore = clampScore(averageScore);
  const demonstratedText = `The student showed understanding of ${describeCoveredConcepts(
    coveredConcepts,
    transcriptTerms
  )}.`;
  const gapText =
    missingConcepts.length > 0
      ? `They did not clearly demonstrate ${describeCoveredConcepts(missingConcepts, [])}.`
      : "The transcript covered the main technical themes that were detectable from the prompt and rubric.";
  const strengths = buildStrengths(coveredConcepts, rubricAlignment);
  const weaknesses = buildWeaknesses(missingConcepts, rubricAlignment);

  return {
    summary: compactText(
      `${demonstratedText} ${gapText}`,
      520
    ),
    strengths: strengths.length > 0 ? strengths : ["Explained parts of the submitted solution."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Instructor should verify any remaining rubric-specific details."],
    rubricAlignment,
    suggestedScore,
  };
}

function completeGeneratedReport(context: ReportFallbackContext, report: GeneratedReportPayload): GeneratedReportPayload {
  const fallback = buildFallbackReport(context);
  const criterionFallbackScore = clampScore(report.suggestedScore) ?? fallback.suggestedScore ?? 60;
  const rubricAlignment =
    report.rubricAlignment.length > 0
      ? report.rubricAlignment.map((criterion) => ({
          ...criterion,
          score: criterion.score === null ? criterionFallbackScore : clampScore(criterion.score),
        }))
      : fallback.rubricAlignment;

  return {
    summary: report.summary || fallback.summary,
    strengths: report.strengths.length > 0 ? report.strengths : fallback.strengths,
    weaknesses: report.weaknesses.length > 0 ? report.weaknesses : fallback.weaknesses,
    rubricAlignment,
    suggestedScore: clampScore(report.suggestedScore) ?? fallback.suggestedScore,
  };
}

function parseGeneratedReport(rawText: string): GeneratedReportPayload {
  let parsed: Partial<GeneratedReportPayload>;

  try {
    parsed = JSON.parse(extractJsonObject(rawText)) as Partial<GeneratedReportPayload>;
  } catch {
    throw new Error("Generated report was not valid JSON.");
  }

  if (
    typeof parsed.summary === "string" &&
    (isModelPlanningText(parsed.summary) ||
      includesInternalFallbackText(parsed.summary) ||
      includesGenericFallbackText(parsed.summary))
  ) {
    throw new Error("Generated report included unusable summary text.");
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 3)
          .map((item) => compactText(item, 150))
      : [],
    weaknesses: Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .slice(0, 3)
          .map((item) => compactText(item, 150))
      : [],
    rubricAlignment: Array.isArray(parsed.rubricAlignment)
      ? parsed.rubricAlignment
          .slice(0, 5)
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const candidate = item as Record<string, unknown>;
            return {
              criterion: typeof candidate.criterion === "string" ? compactText(candidate.criterion, 80) : "",
              assessment: typeof candidate.assessment === "string" ? compactText(candidate.assessment, 180) : "",
              evidence: typeof candidate.evidence === "string" ? compactText(candidate.evidence, 180) : "",
              score: normalizeCriterionScore(candidate.score),
            } satisfies ReportCriterion;
          })
          .filter(
            (item): item is ReportCriterion =>
              Boolean(item && item.criterion && item.assessment && item.evidence)
          )
      : [],
    suggestedScore:
      typeof parsed.suggestedScore === "number"
        ? parsed.suggestedScore
        : typeof parsed.suggestedScore === "string"
          ? Number(parsed.suggestedScore)
          : null,
  };
}

function formatReportSummary(report: GeneratedReportPayload) {
  const sections = [compactText(report.summary, 520)];

  if (report.strengths.length > 0) {
    sections.push(`Strengths\n${report.strengths.map((item) => `- ${compactText(item, 150)}`).join("\n")}`);
  }

  if (report.weaknesses.length > 0) {
    sections.push(`Needs review\n${report.weaknesses.map((item) => `- ${compactText(item, 150)}`).join("\n")}`);
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
    "- Keep summary to 2-3 concise sentences.",
    "- strengths: max 3 bullets, each under 18 words.",
    "- weaknesses: max 3 bullets, each under 18 words.",
    "- rubricAlignment: max 5 criteria; assessment/evidence each under 24 words.",
    "- Every rubricAlignment score must be a 0-100 number. Do not use null unless no transcript evidence exists.",
    "- suggestedScore must be a 0-100 number.",
    "- Do not include long transcript quotes. Paraphrase evidence briefly.",
    "- summary must explain what the student discussed with Ora and how well they demonstrated understanding.",
    "- Include concrete evidence from the interview: correct explanations, misconceptions, uncertainty, and use of code details.",
    "- suggestedScore is 0-100 only when evidence is sufficient.",
    "- suggestedScore should reflect demonstrated comprehension, not just whether code exists.",
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
      responseFormat: "json_object",
    }
  );

  if (!responseText) {
    throw new Error("LLM provider returned an empty report.");
  }

  let parsed: GeneratedReportPayload;

  try {
    parsed = completeGeneratedReport(context, parseGeneratedReport(responseText));
  } catch {
    parsed = buildFallbackReport(context);
  }

  if (!parsed.summary) {
    parsed = buildFallbackReport(context);
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
