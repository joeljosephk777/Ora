import { createClient } from "@/lib/supabase/server";
import { deleteAssignment } from "@/lib/actions/assignments";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type Assignment = {
  id: string;
  title: string;
  description: string;
  rubric: string;
  created_at: string;
};

type Question = { content: string; order_index: number };

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, description, rubric, created_at")
    .eq("id", id)
    .eq("professor_id", user.id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("content, order_index")
    .eq("assignment_id", id)
    .order("order_index");

  const deleteWithId = deleteAssignment.bind(null, id);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/professor/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Created {new Date(assignment.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <Link
            href={`/professor/assignments/${id}/edit`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <form action={deleteWithId}>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              onClick={(e) => {
                if (!confirm("Delete this assignment? This cannot be undone.")) e.preventDefault();
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Description</h2>
          <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{assignment.description}</p>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Grading rubric</h2>
          <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{assignment.rubric}</p>
        </section>

        {questions && questions.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Guiding questions
            </h2>
            <ol className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-800">
                  <span className="text-gray-400 shrink-0">{i + 1}.</span>
                  <span>{q.content}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
