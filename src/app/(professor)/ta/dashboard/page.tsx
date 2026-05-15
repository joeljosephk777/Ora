import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TaDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role === "student") redirect("/student/dashboard");
  if (profile?.role === "professor") redirect("/professor/dashboard");

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TA review queue</h1>
          <p className="mt-1 text-sm text-gray-500">Open any assignment to review student transcripts and reports.</p>
        </div>
      </div>

      {!assignments || assignments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-sm text-gray-500">No assignments are available yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/ta/assignments/${assignment.id}/reports`}
              className="block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{assignment.title}</h2>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{assignment.description}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(assignment.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
