"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type AuthState = { error?: string } | null;
type ResetState = { error?: string; success?: boolean } | null;

function getHomePathForRole(role: string | undefined) {
  if (role === "student") return "/student/dashboard";
  if (role === "ta") return "/ta/dashboard";
  return "/professor/dashboard";
}

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role as string | undefined;
  redirect(getHomePathForRole(role));
}

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const role = formData.get("role") as string;

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        full_name: formData.get("full_name") as string,
        role,
      },
    },
  });

  if (error) return { error: error.message };

  redirect(getHomePathForRole(role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(prevState: ResetState, formData: FormData): Promise<ResetState> {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function updatePassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role as string | undefined;
  redirect(role === "student" ? "/student/dashboard" : "/professor/dashboard");
}
