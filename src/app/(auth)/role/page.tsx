import RoleSelectionForm from "@/components/RoleSelectionForm";
import { getHomePathForRole, isAllowedProfessorEmail, isAllowedUwUser } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function RolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!isAllowedUwUser(user)) {
    await supabase.auth.signOut();
    redirect("/login?error=uw_only");
  }

  const role = user.user_metadata?.role as string | undefined;

  if (role) {
    redirect(getHomePathForRole(role));
  }

  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Choose your Ora role</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        You signed in with {user.email}. Pick the role you will use for this UW course workspace.
      </p>

      <RoleSelectionForm
        defaultName={defaultName}
        professorAllowed={isAllowedProfessorEmail(user.email)}
      />
    </div>
  );
}
