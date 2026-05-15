"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthState = { error?: string } | null;

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
