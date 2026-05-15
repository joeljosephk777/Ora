import SessionReportDetailView from "@/components/SessionReportDetailView";

export default async function TaSessionReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  return <SessionReportDetailView assignmentId={id} sessionId={sessionId} basePath="/ta" />;
}
