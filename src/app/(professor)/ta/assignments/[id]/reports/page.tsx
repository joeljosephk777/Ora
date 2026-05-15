import AssignmentReportsView from "@/components/AssignmentReportsView";

export default async function TaAssignmentReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentReportsView assignmentId={id} basePath="/ta" />;
}
