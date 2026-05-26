import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = user?.user_metadata?.full_name ?? user?.email ?? "Student";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/student/dashboard" className="flex items-center gap-3 text-slate-900">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold tracking-[0.18em] text-white uppercase">
              Ora
            </span>
            <span className="hidden text-sm font-medium text-slate-500 sm:inline">Student workspace</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-600 sm:inline-flex">
              {name}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
