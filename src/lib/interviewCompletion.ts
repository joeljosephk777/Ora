export const COMPLETION_REPLY =
  "That completes the interview. Submit your session when you are ready for instructor review.";

export function isCompletionReply(reply: string) {
  const normalized = reply.toLowerCase();
  return normalized.includes("that completes the interview") && normalized.includes("submit your session");
}
