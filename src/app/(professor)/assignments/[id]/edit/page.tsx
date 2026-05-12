import { createClient } from "@/lib/supabase/server";
import { updateAssignment } from "@/lib/actions/assignments";
import AssignmentForm from "@/components/AssignmentForm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type AssignmentFields = { title: string; description: string; rubric: string };
type Question = { content: string; order_index: number };

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment } = await supabase
    .from("assignments")
    .select("title, description, rubric")
    .eq("id", id)
    .eq("professor_id", user.id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("content, order_index")
    .eq("assignment_id", id)
    .order("order_index");

  const action = updateAssignment.bind(null, id);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/professor/assignments/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to assignment
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit assignment</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <AssignmentForm
          action={action}
          defaultValues={assignment}
          defaultQuestions={questions ?? []}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
