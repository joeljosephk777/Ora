"use server";

import { getGoogleHostedDomainHint, getHomePathForRole, isAllowedProfessorEmail, isAllowedUwUser } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type AuthState = { error?: string } | null;

async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");

  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function signInWithGoogle(_formData?: FormData) {
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      queryParams: {
        hd: getGoogleHostedDomainHint(),
      },
    },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (!data.url) redirect("/login?error=oauth");

  redirect(data.url);
}

export async function selectRole(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!isAllowedUwUser(user)) {
    await supabase.auth.signOut();
    redirect("/login?error=uw_only");
  }

  const role = formData.get("role");

  if (role !== "student" && role !== "professor") {
    return { error: "Choose student or professor." };
  }

  if (role === "professor" && !isAllowedProfessorEmail(user.email)) {
    return { error: "This UW account is not approved for professor access." };
  }

  const fullName =
    (formData.get("full_name") as string | null)?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    "";

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email: user.email ?? "",
      full_name: fullName,
      role,
    })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      full_name: fullName,
      role,
    },
  });

  if (metadataError) return { error: metadataError.message };

  redirect(getHomePathForRole(role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
