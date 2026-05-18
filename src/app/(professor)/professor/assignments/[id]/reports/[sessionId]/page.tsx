import SessionReportDetailView from "@/components/SessionReportDetailView";

export default async function SessionReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  return <SessionReportDetailView assignmentId={id} sessionId={sessionId} basePath="/professor" />;
}
