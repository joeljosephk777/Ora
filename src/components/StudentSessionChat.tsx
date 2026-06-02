"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";

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
  file: File;
};

type ChatMessage = InitialChatMessage & {
  recording?: RecordingAttachment | null;
  pending?: boolean;
};

type PendingPayload = {
  messageId: string;
  message: string;
  recording: RecordingAttachment | null;
  transcribedMessage: string | null;
};

const SCRIBE_V2_CREDITS_PER_HOUR = 0.22;

type ElevenLabsUsage = {
  tier: string | null;
  status: string | null;
  characterCount: number | null;
  characterLimit: number | null;
  nextResetUnix: number | null;
  refreshPeriod: string | null;
};

type ChatTelemetry = {
  model: string | null;
  provider: string | null;
  latencyMs: string | null;
};

type ParsedMessageContent = {
  body: string;
  transcript: string | null;
  attachmentNote: string | null;
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

function formatCompactNumber(value: number | null) {
  if (value === null) return "--";
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatEstimatedCredits(value: number) {
  if (value < 0.001) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function getEstimatedScribeCredits(durationMs: number) {
  return (Math.max(1, durationMs / 1000) / 3600) * SCRIBE_V2_CREDITS_PER_HOUR;
}

function getUsagePercent(usage: ElevenLabsUsage | null) {
  if (!usage?.characterCount || !usage.characterLimit) return 0;
  return Math.min(100, Math.max(0, (usage.characterCount / usage.characterLimit) * 100));
}

function getRecordedUsagePercent(durationMs: number) {
  const softLimitMs = 5 * 60 * 1000;
  return Math.min(100, Math.max(4, (durationMs / softLimitMs) * 100));
}

function getResetLabel(nextResetUnix: number | null) {
  if (!nextResetUnix) return null;

  return new Date(nextResetUnix * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getRefreshPeriodLabel(refreshPeriod: string | null) {
  if (!refreshPeriod) return null;
  return refreshPeriod.replaceAll("_", " ");
}

function extractResponseMessage(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  if (typeof record.text === "string") return record.text;
  if (typeof record.reply === "string") return record.reply;
  if (typeof record.message === "string") return record.message;
  if (typeof record.transcript === "string") return record.transcript;
  if (typeof record.content === "string") return record.content;
  if (typeof record.aiResponse === "string") return record.aiResponse;
  if (typeof record.response === "string") return record.response;

  if (record.message && typeof record.message === "object") {
    const nested = record.message as Record<string, unknown>;
    if (typeof nested.content === "string") return nested.content;
  }

  return null;
}

function parseSsePayload(frame: string) {
  const lines = frame.split("\n");
  const eventName = lines
    .find((line) => line.startsWith("event: "))
    ?.slice(7)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .join("\n");

  if (!data) return null;

  try {
    return {
      eventName,
      payload: JSON.parse(data) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function getVoiceTranscriptLabel(transcript: string) {
  return `Voice note transcript:\n${transcript}`;
}

function parseMessageContent(content: string): ParsedMessageContent {
  const attachmentMatch = content.match(/\n\n(\[Voice annotation attached:[^\n]+\])$/);
  const attachmentNote = attachmentMatch?.[1] ?? null;
  const contentWithoutAttachment = attachmentMatch
    ? content.slice(0, attachmentMatch.index).trim()
    : content.trim();
  const marker = "\n\nVoice note transcript:\n";
  const markerIndex = contentWithoutAttachment.lastIndexOf(marker);

  if (markerIndex !== -1) {
    return {
      body: contentWithoutAttachment.slice(0, markerIndex).trim(),
      transcript: contentWithoutAttachment.slice(markerIndex + marker.length).trim() || null,
      attachmentNote,
    };
  }

  if (contentWithoutAttachment.startsWith("Voice note transcript:\n")) {
    return {
      body: "",
      transcript: contentWithoutAttachment.slice("Voice note transcript:\n".length).trim() || null,
      attachmentNote,
    };
  }

  return {
    body: contentWithoutAttachment,
    transcript: null,
    attachmentNote,
  };
}

function stripVoiceTranscript(content: string) {
  return parseMessageContent(content).body;
}

function buildDisplayContent(message: string, transcribedMessage: string | null) {
  if (message && transcribedMessage) return `${message}\n\n${getVoiceTranscriptLabel(transcribedMessage)}`;
  if (message) return message;
  if (transcribedMessage) return getVoiceTranscriptLabel(transcribedMessage);
  return "";
}

function extractCodeBlocks(content: string) {
  const snippets: string[] = [];
  const pattern = /```(?:([\w-]+)\n)?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const codeSegment = match[2]?.trim();
    if (codeSegment) snippets.push(codeSegment);
  }

  return snippets.join("\n\n---\n\n");
}

function splitMessageContent(content: string) {
  const segments: Array<{ type: "text" | "code"; value: string }> = [];
  const pattern = /```(?:([\w-]+)\n)?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = content.slice(lastIndex, match.index).trim();
      if (textSegment) segments.push({ type: "text", value: textSegment });
    }

    const codeSegment = match[2]?.trim();
    if (codeSegment) segments.push({ type: "code", value: codeSegment });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    const trailingText = content.slice(lastIndex).trim();
    if (trailingText) segments.push({ type: "text", value: trailingText });
  }

  return segments.length > 0 ? segments : [{ type: "text" as const, value: content }];
}

function getStatusMeta(status: Props["initialStatus"]) {
  if (status === "completed") {
    return {
      badgeClasses: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "Completed",
    };
  }

  if (status === "in_progress") {
    return {
      badgeClasses: "border border-amber-200 bg-amber-50 text-amber-700",
      label: "In progress",
    };
  }

  return {
    badgeClasses: "border border-sky-200 bg-sky-50 text-sky-700",
    label: "Ready",
  };
}

export default function StudentSessionChat({
  sessionId,
  assignmentTitle,
  initialStatus,
  initialMessages,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState<RecordingAttachment | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPayload, setLastFailedPayload] = useState<PendingPayload | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlocked, setRecordingBlocked] = useState(false);
  const [draftSourceId, setDraftSourceId] = useState<string | null>(null);
  const [elevenLabsUsage, setElevenLabsUsage] = useState<ElevenLabsUsage | null>(null);
  const [lastVoiceUsage, setLastVoiceUsage] = useState<{
    durationMs: number;
    estimatedCredits: number;
  } | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [lastTelemetry, setLastTelemetry] = useState<ChatTelemetry | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  async function loadElevenLabsUsage() {
    setIsUsageLoading(true);

    try {
      const response = await fetch("/api/elevenlabs/usage", {
        cache: "no-store",
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
        throw new Error(extractResponseMessage(parsedBody) ?? "Failed to load ElevenLabs usage.");
      }

      if (!parsedBody || typeof parsedBody !== "object") {
        throw new Error("ElevenLabs usage response was empty.");
      }

      const usage = parsedBody as ElevenLabsUsage;
      setElevenLabsUsage({
        tier: typeof usage.tier === "string" ? usage.tier : null,
        status: typeof usage.status === "string" ? usage.status : null,
        characterCount: typeof usage.characterCount === "number" ? usage.characterCount : null,
        characterLimit: typeof usage.characterLimit === "number" ? usage.characterLimit : null,
        nextResetUnix: typeof usage.nextResetUnix === "number" ? usage.nextResetUnix : null,
        refreshPeriod: typeof usage.refreshPeriod === "string" ? usage.refreshPeriod : null,
      });
    } catch (usageLoadError) {
      console.warn(usageLoadError instanceof Error ? usageLoadError.message : "Failed to load ElevenLabs usage.");
    } finally {
      setIsUsageLoading(false);
    }
  }

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 320)}px`;
  }, [draft]);

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

  async function transcribeRecording(attachment: RecordingAttachment) {
    const formData = new FormData();
    formData.append("file", attachment.file, attachment.file.name);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
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
          (response.status === 404 ? "Transcription API is not available yet." : "Failed to transcribe audio.")
      );
    }

    const transcript = extractResponseMessage(parsedBody);

    if (!transcript) {
      throw new Error("Transcription response did not include any text.");
    }

    setLastVoiceUsage({
      durationMs: attachment.durationMs,
      estimatedCredits: getEstimatedScribeCredits(attachment.durationMs),
    });
    void loadElevenLabsUsage();

    return transcript;
  }

  async function sendMessage(payload?: PendingPayload) {
    if (sendInFlightRef.current) return;

    const optimisticId = payload?.messageId ?? `local-${Date.now()}`;
    const nextPayload = payload ?? {
      messageId: optimisticId,
      message: draft.trim(),
      recording,
      transcribedMessage: null,
    };

    if (!nextPayload.message && !nextPayload.recording) return;

    setIsSending(true);
    sendInFlightRef.current = true;
    setError(null);

    if (!payload) {
      setDraft("");
      setRecording(null);
      setDraftSourceId(null);
      setMessages((current) => [
        ...current,
        {
          id: optimisticId,
          role: "student",
          content:
            buildDisplayContent(nextPayload.message, nextPayload.transcribedMessage) ||
            (nextPayload.recording ? "Voice note ready to transcribe." : "Sending..."),
          createdAt: new Date().toISOString(),
          recording: nextPayload.recording,
          pending: true,
        },
      ]);
    }

    let transcribedMessage = nextPayload.transcribedMessage;

    try {
      await markSessionInProgress();

      if (!transcribedMessage && nextPayload.recording) {
        transcribedMessage = await transcribeRecording(nextPayload.recording);
      }

      const composedMessage = nextPayload.message || transcribedMessage || "";

      if (!composedMessage) {
        throw new Error("Add a typed response, code snippet, or voice note before sending.");
      }

      const displayContent = buildDisplayContent(nextPayload.message, transcribedMessage);
      const associatedCodeSnippet = nextPayload.recording ? extractCodeBlocks(nextPayload.message) : "";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(developerMode ? { "X-Developer-Mode": "true" } : {}),
        },
        body: JSON.stringify({
          sessionId,
          studentMessage: nextPayload.message || undefined,
          voiceTranscription: transcribedMessage || undefined,
          associatedCodeSnippet: associatedCodeSnippet || undefined,
          voiceAnnotation: nextPayload.recording
            ? {
                durationMs: nextPayload.recording.durationMs,
                mimeType: nextPayload.recording.mimeType,
              }
            : null,
        }),
      });

      if (developerMode) {
        setLastTelemetry({
          model: response.headers.get("X-Dev-Model"),
          provider: response.headers.get("X-Dev-Provider"),
          latencyMs: response.headers.get("X-Dev-Latency-Ms"),
        });
      }

      if (response.ok && response.body && response.headers.get("Content-Type")?.includes("text/event-stream")) {
        const aiMessageId = `ai-${Date.now()}`;
        let aiMessage = "";
        let buffered = "";
        const decoder = new TextDecoder();
        const reader = response.body.getReader();

        setMessages((current) => [
          ...current.map((message) =>
            message.id === optimisticId
              ? {
                  ...message,
                  pending: false,
                  content: displayContent,
                }
              : message
          ),
          {
            id: aiMessageId,
            role: "ai",
            content: "",
            createdAt: new Date().toISOString(),
            pending: true,
          },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffered += decoder.decode(value, { stream: true });
          const frames = buffered.split("\n\n");
          buffered = frames.pop() ?? "";

          for (const frame of frames) {
            const parsedFrame = parseSsePayload(frame);
            if (!parsedFrame) continue;

            if (parsedFrame.eventName === "error") {
              throw new Error(extractResponseMessage(parsedFrame.payload) ?? "Ora failed while streaming.");
            }

            if (typeof parsedFrame.payload.delta === "string") {
              aiMessage += parsedFrame.payload.delta;
              setMessages((current) =>
                current.map((message) =>
                  message.id === aiMessageId
                    ? {
                        ...message,
                        content: aiMessage,
                      }
                  : message
                )
              );
            }

            if (parsedFrame.payload.done === true && parsedFrame.payload.completed === true) {
              setStatus("completed");
            }
          }
        }

        if (!aiMessage.trim()) {
          throw new Error("Chat response did not include an AI reply.");
        }

        setMessages((current) =>
          current.map((message) =>
            message.id === aiMessageId
              ? {
                  ...message,
                  pending: false,
                  content: aiMessage.trim(),
                }
              : message
          )
        );

        if (payload && draft.trim() === nextPayload.message && recording?.url === nextPayload.recording?.url) {
          setDraft("");
          setRecording(null);
          setDraftSourceId(null);
        }

        setLastFailedPayload(null);
        return;
      }

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
        ...current.map((message) =>
          message.id === optimisticId
            ? {
                ...message,
                pending: false,
                content: displayContent,
              }
            : message
        ),
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: aiMessage,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (payload && draft.trim() === nextPayload.message && recording?.url === nextPayload.recording?.url) {
        setDraft("");
        setRecording(null);
        setDraftSourceId(null);
      }

      setLastFailedPayload(null);
    } catch (sendError) {
      setLastFailedPayload({
        ...nextPayload,
        transcribedMessage,
      });
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.");
      setMessages((current) =>
        payload
          ? current
          : current.map((message) =>
              message.id === optimisticId
                ? {
                    ...message,
                    pending: false,
                    content: buildDisplayContent(nextPayload.message, transcribedMessage) || message.content,
                  }
                : message
            )
      );
    } finally {
      sendInFlightRef.current = false;
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
        const extension = (recorder.mimeType || "audio/webm").includes("mpeg") ? "mp3" : "webm";
        const file = new File([blob], `voice-annotation-${Date.now()}.${extension}`, {
          type: recorder.mimeType || "audio/webm",
        });
        objectUrlsRef.current.push(nextUrl);
        setRecording({
          url: nextUrl,
          durationMs,
          mimeType: recorder.mimeType || "audio/webm",
          file,
        });
        setLastVoiceUsage(null);
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
    setLastVoiceUsage(null);
  }

  function reuseMessage(message: ChatMessage) {
    if (message.id !== latestStudentMessageId) return;

    setDraftSourceId(message.id);
    setDraft(stripVoiceTranscript(message.content));
    setRecording(message.recording ?? null);
    setError(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }

  function insertCodeBlock() {
    const textarea = composerRef.current;
    const template = "```ts\n// paste code snippet here\n```";

    if (!textarea) {
      setDraft((current) => [current.trimEnd(), template].filter(Boolean).join("\n\n"));
      return;
    }

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const nextValue = `${draft.slice(0, start)}${template}${draft.slice(end)}`;

    setDraft(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPosition = start + template.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || isSending || status === "completed") return;

    event.preventDefault();
    if (!draft.trim() && !recording) return;
    void sendMessage();
  }

  const latestStudentMessageId = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "student") return message.id;
    }
    return null;
  })();
  const canSend = !isSending && status !== "completed" && Boolean(draft.trim() || recording);
  const statusMeta = getStatusMeta(status);
  const messageCount = messages.filter((message) => !message.pending).length;
  const usagePercent = getUsagePercent(elevenLabsUsage);
  const resetLabel = getResetLabel(elevenLabsUsage?.nextResetUnix ?? null);
  const refreshPeriodLabel = getRefreshPeriodLabel(elevenLabsUsage?.refreshPeriod ?? null);
  const shouldShowVoiceUsage = Boolean(recording || lastVoiceUsage || elevenLabsUsage || isUsageLoading);

  return (
    <section className="flex min-h-[760px] flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="border-b border-slate-200/80 bg-white/80 px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Live interview</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Conversation with Ora</h2>
            <p className="mt-2 text-sm text-slate-500">
              {assignmentTitle} · Explain your decisions, share code when useful, and keep each reply focused.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600">
              {messageCount} {messageCount === 1 ? "message" : "messages"}
            </span>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${statusMeta.badgeClasses}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.94)_0%,rgba(241,245,249,0.86)_100%)] px-4 py-5 sm:px-6"
      >
        {messages.length === 0 && !isSending ? (
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-2xl rounded-[2rem] border border-dashed border-slate-300 bg-white/80 p-8 text-center shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Ready when you are</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Start with how you approached the assignment</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
                A strong first answer usually covers the main idea, the parts you found most important, and any design
                tradeoffs or debugging decisions that shaped the final implementation.
              </p>

              <div className="mt-6 grid gap-3 text-left md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Good opener</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Summarize the problem and the architecture you chose.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Use code</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Paste a snippet when the implementation matters more than the description.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stay concrete</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Reference actual functions, decisions, and tradeoffs instead of broad claims.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => {
              const isStudent = message.role === "student";
              const parsedContent = parseMessageContent(message.content);
              const hasMainBody = Boolean(parsedContent.body);
              const showReuseAction =
                isStudent && !message.pending && status !== "completed" && message.id === latestStudentMessageId;

              return (
                <div key={message.id} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`w-full max-w-2xl rounded-[1.75rem] px-5 py-4 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.35)] ${
                      isStudent
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200/80 bg-white/95 text-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${isStudent ? "text-slate-200" : "text-slate-500"}`}>
                          {isStudent ? "You" : "Ora"}
                        </span>
                        {showReuseAction && (
                          <button
                            type="button"
                            onClick={() => reuseMessage(message)}
                            className={`text-[11px] font-medium ${
                              isStudent
                                ? "text-slate-300 transition-colors hover:text-white"
                                : "text-slate-500 transition-colors hover:text-slate-900"
                            }`}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <span className={`text-xs ${isStudent ? "text-slate-300" : "text-slate-400"}`}>
                        {message.pending
                          ? "Sending..."
                          : new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      {hasMainBody ? (
                        splitMessageContent(parsedContent.body).map((segment, index) =>
                          segment.type === "code" ? (
                            <pre
                              key={`${message.id}-code-${index}`}
                              className={`overflow-x-auto rounded-2xl p-4 text-xs leading-relaxed ${
                                isStudent ? "bg-slate-800 text-slate-100" : "bg-slate-950 text-slate-100"
                              }`}
                            >
                              <code>{segment.value}</code>
                            </pre>
                          ) : (
                            <p
                              key={`${message.id}-text-${index}`}
                              className={`whitespace-pre-wrap text-sm leading-7 ${
                                isStudent ? "text-white" : "text-slate-700"
                              }`}
                            >
                              {segment.value}
                            </p>
                          )
                        )
                      ) : (
                        <p className={`text-sm leading-7 ${isStudent ? "text-slate-100" : "text-slate-600"}`}>
                          Voice note attached.
                        </p>
                      )}
                    </div>

                    {parsedContent.transcript && (
                      <div
                        className={`mt-4 rounded-2xl px-4 py-3 ${
                          isStudent ? "bg-slate-800/90" : "bg-slate-50"
                        }`}
                      >
                        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isStudent ? "text-slate-300" : "text-slate-500"}`}>
                          Voice transcript
                        </p>
                        <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${isStudent ? "text-slate-100" : "text-slate-600"}`}>
                          {parsedContent.transcript}
                        </p>
                      </div>
                    )}

                    {!message.recording && parsedContent.attachmentNote && (
                      <div
                        className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                          isStudent ? "bg-slate-800/90 text-slate-200" : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {parsedContent.attachmentNote}
                      </div>
                    )}

                    {message.recording && (
                      <div className={`mt-4 rounded-2xl p-4 ${isStudent ? "bg-slate-800/90" : "bg-slate-50"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${isStudent ? "text-slate-300" : "text-slate-500"}`}>
                            Voice note
                          </span>
                          <span className={`text-xs ${isStudent ? "text-slate-300" : "text-slate-500"}`}>
                            {getRecordingTimeLabel(message.recording.durationMs)}
                          </span>
                        </div>
                        <audio className="mt-3 w-full" controls src={message.recording.url} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="w-full max-w-xl rounded-[1.75rem] border border-slate-200/80 bg-white/95 px-5 py-4 text-slate-900 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.35)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ora</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Ora is responding and will follow up with one focused question.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-white/90 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {draftSourceId && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              You are revising your latest answer in the composer. Sending will add a new message and keep the
              original transcript intact.
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
              {lastFailedPayload && (
                <button
                  type="button"
                  onClick={() => {
                    void sendMessage(lastFailedPayload);
                  }}
                  disabled={isSending}
                  className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={insertCodeBlock}
              disabled={isSending || status === "completed"}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
            >
              Insert code block
            </button>

            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                Stop recording
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={status === "completed"}
                className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              >
                {recording ? "Replace voice note" : "Add voice note"}
              </button>
            )}

            {recording && (
              <button
                type="button"
                onClick={clearRecording}
                className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Remove voice note
              </button>
            )}

            <button
              type="button"
              onClick={() => setDeveloperMode((current) => !current)}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                developerMode
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              Dev telemetry
            </button>

            <span className="ml-auto text-xs text-slate-400">Enter to send · Shift+Enter for a new line</span>
          </div>

          {developerMode && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                AI developer telemetry
              </p>
              <p className="mt-2 text-sm text-violet-800">
                {lastTelemetry
                  ? `Provider ${lastTelemetry.provider ?? "--"} · Model ${lastTelemetry.model ?? "--"} · First-byte ${lastTelemetry.latencyMs ?? "--"}ms`
                  : "Adds X-Developer-Mode to the next /api/chat request and shows provider routing headers."}
              </p>
            </div>
          )}

          {recording && (
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Voice note attached</p>
                  <p className="text-xs text-slate-500">
                    {getRecordingTimeLabel(recording.durationMs)} · transcribed automatically on send
                  </p>
                </div>
              </div>
              <audio className="mt-3 w-full" controls src={recording.url} />
            </div>
          )}

          {shouldShowVoiceUsage && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    ElevenLabs voice usage
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {lastVoiceUsage
                      ? `${getRecordingTimeLabel(lastVoiceUsage.durationMs)} audio used about ${formatEstimatedCredits(
                          lastVoiceUsage.estimatedCredits
                        )} credits.`
                      : recording
                        ? `${getRecordingTimeLabel(recording.durationMs)} audio ready to transcribe, about ${formatEstimatedCredits(
                            getEstimatedScribeCredits(recording.durationMs)
                          )} credits.`
                        : isUsageLoading
                          ? "Refreshing account usage..."
                          : "Voice transcription usage will update after the next recording."}
                  </p>
                  {(lastVoiceUsage || recording) && (
                    <p className="mt-1 text-xs text-slate-500">
                      Scribe v2 is metered by audio duration, so this is an immediate estimate from the recorded length.
                    </p>
                  )}
                </div>
                {elevenLabsUsage && (
                  <div className="min-w-[180px]">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{Math.round(usagePercent)}% quota used</span>
                      {resetLabel && <span>Resets {resetLabel}</span>}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePercent >= 90 ? "bg-red-500" : usagePercent >= 75 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatCompactNumber(elevenLabsUsage.characterCount)} / {formatCompactNumber(elevenLabsUsage.characterLimit)} chars
                      {refreshPeriodLabel ? ` (${refreshPeriodLabel})` : ""}
                    </p>
                  </div>
                )}
              </div>
              {recording && !lastVoiceUsage && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${getRecordedUsagePercent(recording.durationMs)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {recordingBlocked && (
            <p className="text-sm text-amber-700">Microphone access is unavailable in this browser session.</p>
          )}

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-50/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              disabled={isSending || status === "completed"}
              placeholder="Type your answer here. Paste code directly, use Insert code block for formatting, or attach a voice note when it is easier to explain aloud."
              className="min-h-[120px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
            />

            <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200/80 px-2 pt-3">
              <p className="max-w-xl text-xs leading-5 text-slate-500">
                Ora keeps the interview focused with one follow-up question at a time, so concise and concrete answers
                work best.
              </p>
              <button
                type="button"
                onClick={() => {
                  void sendMessage();
                }}
                disabled={!canSend}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSending ? "Ora is responding..." : "Send message"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
