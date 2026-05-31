import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export async function GET() {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ message: "ELEVENLABS_API_KEY is not configured." }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "You must be signed in to view ElevenLabs usage." }, { status: 401 });
    }

    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      cache: "no-store",
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
      const upstreamMessage =
        parsedBody && typeof parsedBody === "object" && typeof (parsedBody as Record<string, unknown>).detail === "string"
          ? (parsedBody as Record<string, unknown>).detail
          : typeof parsedBody === "string"
            ? parsedBody
            : "Failed to load ElevenLabs usage.";

      return NextResponse.json({ message: upstreamMessage }, { status: response.status });
    }

    if (!parsedBody || typeof parsedBody !== "object") {
      return NextResponse.json({ message: "ElevenLabs usage response was empty." }, { status: 502 });
    }

    const usage = parsedBody as Record<string, unknown>;

    return NextResponse.json({
      tier: readString(usage, "tier"),
      status: readString(usage, "status"),
      characterCount: readNumber(usage, "character_count"),
      characterLimit: readNumber(usage, "character_limit"),
      nextResetUnix: readNumber(usage, "next_character_count_reset_unix"),
      refreshPeriod: readString(usage, "character_refresh_period"),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load ElevenLabs usage.",
      },
      { status: 500 }
    );
  }
}
