import { getHomePathForRole, isAllowedUwUser } from "@/lib/auth/rules";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedUwUser(user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=uw_only`);
  }

  const role = user?.user_metadata?.role as string | undefined;

  return NextResponse.redirect(`${origin}${getHomePathForRole(role)}`);
}
