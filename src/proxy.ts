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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const role = user?.user_metadata?.role as string | undefined;
  const isProfessor = role === "professor" || role === "ta";

  // Redirect authenticated users away from auth pages
  if (user && (path === "/login" || path === "/signup")) {
    const dest = isProfessor ? "/professor/dashboard" : "/student/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Protect professor routes
  if (path.startsWith("/professor")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (!isProfessor) return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect student routes
  if (path.startsWith("/student")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
  }

  // Root redirect
  if (path === "/") {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const dest = isProfessor ? "/professor/dashboard" : "/student/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
