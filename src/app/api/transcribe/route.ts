import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function extractTranscript(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  if (typeof record.text === "string") return record.text;
  if (typeof record.transcript === "string") return record.transcript;
  if (typeof record.message === "string") return record.message;

  return null;
}

export async function POST(request: Request) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ message: "ELEVENLABS_API_KEY is not configured." }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "You must be signed in to transcribe audio." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Audio file is required." }, { status: 400 });
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append("model_id", "scribe_v2");
    upstreamFormData.append("file", file, file.name);
    upstreamFormData.append("tag_audio_events", "true");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: upstreamFormData,
    });

    const responseText = await response.text();
    let parsedBody: unknown = null;

    if (responseText) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText;
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            extractTranscript(parsedBody) ||
            (typeof parsedBody === "string" ? parsedBody : "Failed to transcribe audio."),
        },
        { status: response.status }
      );
    }

    const text = extractTranscript(parsedBody);

    if (!text) {
      return NextResponse.json({ message: "ElevenLabs did not return any transcript text." }, { status: 502 });
    }

    return NextResponse.json({
      text,
      languageCode:
        parsedBody && typeof parsedBody === "object" && typeof (parsedBody as Record<string, unknown>).language_code === "string"
          ? (parsedBody as Record<string, unknown>).language_code
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to transcribe audio.",
      },
      { status: 500 }
    );
  }
}
