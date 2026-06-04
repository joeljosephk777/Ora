import { getHomePathForRole, isAllowedUwUser } from "@/lib/auth/rules";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const role = user?.user_metadata?.role as string | undefined;
  const hasRole = role === "student" || role === "ta" || role === "professor";
  const isStudent = role === "student";
  const isTa = role === "ta";
  const homePath = getHomePathForRole(role);

  if (user && !isAllowedUwUser(user) && !path.startsWith("/auth/callback")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=uw_only", request.url));
  }

  if (user && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  if (path === "/role") {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (!isAllowedUwUser(user)) return NextResponse.redirect(new URL("/login?error=uw_only", request.url));
    if (hasRole) return NextResponse.redirect(new URL(homePath, request.url));
    return supabaseResponse;
  }

  if (path.startsWith("/professor")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (!hasRole) return NextResponse.redirect(new URL("/role", request.url));
    if (isStudent) return NextResponse.redirect(new URL("/student/dashboard", request.url));
    if (isTa) return NextResponse.redirect(new URL("/ta/dashboard", request.url));
  }

  if (path.startsWith("/ta")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (!hasRole) return NextResponse.redirect(new URL("/role", request.url));
    if (isStudent) return NextResponse.redirect(new URL("/student/dashboard", request.url));
    if (!isTa) return NextResponse.redirect(new URL("/professor/dashboard", request.url));
  }

  if (path.startsWith("/student")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (!hasRole) return NextResponse.redirect(new URL("/role", request.url));
  }

  if (path === "/") {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
