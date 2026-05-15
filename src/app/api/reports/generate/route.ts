import { generateAndSaveReport } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type GenerateReportRequestBody = {
  sessionId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "You must be signed in to generate reports." }, { status: 401 });
    }

    const body = (await request.json()) as GenerateReportRequestBody;
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return NextResponse.json({ message: "sessionId is required." }, { status: 400 });
    }

    const { report } = await generateAndSaveReport(supabase, sessionId);

    return NextResponse.json({
      report: {
        id: report.id,
        sessionId: report.session_id,
        summary: report.summary,
        rubricAlignment: report.rubric_alignment,
        suggestedScore: report.suggested_score,
        finalScore: report.final_score,
        reviewedBy: report.reviewed_by,
        reviewedAt: report.reviewed_at,
        createdAt: report.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to generate report.",
      },
      { status: 500 }
    );
  }
}
