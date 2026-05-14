"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";

export type InitialChatMessage = {
  id: string;
  role: "ai" | "student";
  content: string;
  createdAt: string;
};

type RecordingAttachment = {
  url: string;
  durationMs: number;
  mimeType: string;
};

type ChatMessage = InitialChatMessage & {
  snippet?: string;
  recording?: RecordingAttachment | null;
  pending?: boolean;
};

type PendingPayload = {
  messageId: string;
  message: string;
  snippet: string;
  recording: RecordingAttachment | null;
};

type Props = {
  sessionId: string;
  assignmentTitle: string;
  initialStatus: "pending" | "in_progress" | "completed";
  initialMessages: InitialChatMessage[];
};

function getRecordingTimeLabel(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function extractResponseMessage(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  if (typeof record.reply === "string") return record.reply;
  if (typeof record.message === "string") return record.message;
  if (typeof record.content === "string") return record.content;
  if (typeof record.aiResponse === "string") return record.aiResponse;
  if (typeof record.response === "string") return record.response;

  if (record.message && typeof record.message === "object") {
    const nested = record.message as Record<string, unknown>;
    if (typeof nested.content === "string") return nested.content;
  }

  return null;
}

function getDisplayContent(message: string, attachedSnippet: string) {
  if (message) return message;
  if (attachedSnippet) return "Shared a code snippet.";
  return "";
}

export default function StudentSessionChat({
  sessionId,
  assignmentTitle,
  initialStatus,
  initialMessages,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState("");
  const [snippet, setSnippet] = useState("");
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [recording, setRecording] = useState<RecordingAttachment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPayload, setLastFailedPayload] = useState<PendingPayload | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlocked, setRecordingBlocked] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function markSessionInProgress() {
    if (status !== "pending") return;

    const startedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "in_progress",
        started_at: startedAt,
      })
      .eq("id", sessionId);

    if (!updateError) setStatus("in_progress");
  }

  async function sendMessage(payload?: PendingPayload) {
    const optimisticId = payload?.messageId ?? `local-${Date.now()}`;
    const nextPayload = payload ?? {
      messageId: optimisticId,
      message: draft.trim(),
      snippet: snippet.trim(),
      recording,
    };

    if (!nextPayload.message && !nextPayload.snippet) return;

    setIsSending(true);
    setError(null);

    const composedContent = nextPayload.snippet
      ? [nextPayload.message, `\`\`\`\n${nextPayload.snippet}\n\`\`\``].filter(Boolean).join("\n\n")
      : nextPayload.message;

    if (!payload) {
      setMessages((current) => [
        ...current,
        {
          id: optimisticId,
          role: "student",
          content: getDisplayContent(nextPayload.message, nextPayload.snippet),
          createdAt: new Date().toISOString(),
          snippet: nextPayload.snippet || undefined,
          recording: nextPayload.recording,
          pending: true,
        },
      ]);
    }

    try {
      await markSessionInProgress();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: composedContent || nextPayload.message,
          codeSnippet: nextPayload.snippet || null,
          voiceAnnotation: nextPayload.recording
            ? {
                durationMs: nextPayload.recording.durationMs,
                mimeType: nextPayload.recording.mimeType,
              }
            : null,
        }),
      });

      const responseBody = await response.text();
      let parsedBody: unknown = null;
      if (responseBody) {
        try {
          parsedBody = JSON.parse(responseBody);
        } catch {
          parsedBody = responseBody;
        }
      }

      if (!response.ok) {
        throw new Error(
          extractResponseMessage(parsedBody) ??
            (response.status === 404 ? "Chat API is not available yet." : "Failed to send message.")
        );
      }

      const aiMessage = extractResponseMessage(parsedBody);

      if (!aiMessage) {
        throw new Error("Chat response did not include an AI reply.");
      }

      setMessages((current) => [
        ...current.map((message) => (message.id === optimisticId ? { ...message, pending: false } : message)),
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: aiMessage,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (
        !payload ||
        (draft.trim() === nextPayload.message &&
          snippet.trim() === nextPayload.snippet &&
          recording?.url === nextPayload.recording?.url)
      ) {
        setDraft("");
        setSnippet("");
        setSnippetOpen(false);
        setRecording(null);
      }
      setLastFailedPayload(null);
    } catch (sendError) {
      setLastFailedPayload(nextPayload);
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.");
      setMessages((current) =>
        payload ? current : current.map((message) => (message.id === optimisticId ? { ...message, pending: false } : message))
      );
    } finally {
      setIsSending(false);
    }
  }

  async function startRecording() {
    if (typeof window === "undefined" || !navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setRecordingBlocked(true);
      return;
    }

    setError(null);
    setRecordingBlocked(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordingStartRef.current = Date.now();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const durationMs = Date.now() - recordingStartRef.current;
        const nextUrl = URL.createObjectURL(blob);
        objectUrlsRef.current.push(nextUrl);
        setRecording({
          url: nextUrl,
          durationMs,
          mimeType: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
      });

      recorder.start();
      setIsRecording(true);
    } catch {
      setRecordingBlocked(true);
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recorderRef.current.stop();
  }

  function clearRecording() {
    setRecording(null);
  }

  const canSend = !isSending && status !== "completed" && Boolean(draft.trim() || snippet.trim());

  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-[720px] flex flex-col">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">{assignmentTitle}</h2>
          <p className="text-sm text-gray-500">{messages.length} messages</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
          {status.replace("_", " ")}
        </span>
      </div>

      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-gray-700">Ready when you are.</p>
              <p className="mt-1 text-sm text-gray-500">Share your reasoning, examples, and code context in the thread.</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isStudent = message.role === "student";
            return (
              <div key={message.id} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                    isStudent ? "bg-indigo-600 text-white" : "bg-white text-gray-900 border border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-medium ${isStudent ? "text-indigo-100" : "text-gray-500"}`}>
                      {isStudent ? "You" : "Ora"}
                    </span>
                    <span className={`text-xs ${isStudent ? "text-indigo-100" : "text-gray-400"}`}>
                      {message.pending
                        ? "Sending..."
                        : new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </span>
                  </div>

                  <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${isStudent ? "text-white" : "text-gray-800"}`}>
                    {message.content}
                  </p>

                  {message.snippet && (
                    <pre
                      className={`mt-3 overflow-x-auto rounded-xl p-3 text-xs leading-relaxed ${
                        isStudent ? "bg-indigo-700 text-indigo-50" : "bg-gray-900 text-gray-100"
                      }`}
                    >
                      <code>{message.snippet}</code>
                    </pre>
                  )}

                  {message.recording && (
                    <div className={`mt-3 rounded-xl p-3 ${isStudent ? "bg-indigo-700" : "bg-gray-100"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-medium ${isStudent ? "text-indigo-100" : "text-gray-600"}`}>
                          Voice annotation
                        </span>
                        <span className={`text-xs ${isStudent ? "text-indigo-100" : "text-gray-500"}`}>
                          {getRecordingTimeLabel(message.recording.durationMs)}
                        </span>
                      </div>
                      <audio className="mt-2 w-full" controls src={message.recording.url} />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 p-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            {lastFailedPayload && (
              <button
                type="button"
                onClick={() => sendMessage(lastFailedPayload)}
                disabled={isSending}
                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSnippetOpen((current) => !current)}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              snippetOpen || snippet
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {snippetOpen || snippet ? "Code snippet attached" : "Add code snippet"}
          </button>

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-700"
            >
              Stop recording
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={status === "completed"}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {recording ? "Replace voice annotation" : "Add voice annotation"}
            </button>
          )}

          {recording && (
            <button
              type="button"
              onClick={clearRecording}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Remove voice annotation
            </button>
          )}
        </div>

        {snippetOpen && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Code snippet</label>
            <textarea
              value={snippet}
              onChange={(event) => setSnippet(event.target.value)}
              rows={6}
              disabled={status === "completed"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y disabled:bg-gray-100"
            />
          </div>
        )}

        {recording && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Voice annotation</p>
                <p className="text-xs text-gray-500">{getRecordingTimeLabel(recording.durationMs)}</p>
              </div>
            </div>
            <audio className="mt-3 w-full" controls src={recording.url} />
          </div>
        )}

        {recordingBlocked && (
          <p className="text-sm text-amber-700">Microphone access is unavailable in this browser session.</p>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your response</label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              disabled={isSending || status === "completed"}
              placeholder="Explain your approach, tradeoffs, and examples."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y disabled:bg-gray-100"
            />
          </div>
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!canSend}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}
