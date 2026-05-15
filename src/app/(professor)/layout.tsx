import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role as string | undefined;
  const name = user?.user_metadata?.full_name ?? user?.email ?? (role === "ta" ? "TA" : "Professor");
  const homeHref = role === "ta" ? "/ta/dashboard" : "/professor/dashboard";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={homeHref} className="text-lg font-bold text-gray-900">
            Ora
          </Link>
          <div className="flex items-center gap-4">
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
