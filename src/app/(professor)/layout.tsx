import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name = user?.user_metadata?.full_name ?? user?.email ?? "Professor";
  const role = (user?.user_metadata?.role as string | undefined) ?? "professor";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/professor/dashboard" className="text-lg font-bold text-gray-900">
            Ora
          </Link>
          <div className="flex items-center gap-3">
            <RoleBadge role={role} />
            <span className="text-sm text-gray-600">{name}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    professor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    student: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ta: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  const cls = styles[role] ?? "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}
