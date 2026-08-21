import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()`.
// This refreshes the Supabase auth session on every request and redirects
// unauthenticated users away from the dashboard to /login.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  // /auth/* handles invite/recovery links (confirming a token, then setting a
  // password) — those requests arrive with no session yet, so they must be
  // exempt from the "no user -> /login" redirect below.
  const isAuthFlowPage = request.nextUrl.pathname.startsWith("/auth/");

  if (!user && !isLoginPage && !isAuthFlowPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Statické soubory v /public (loga, PDF worker, šablony) musí projít bez
  // přihlášení — bez téhle výjimky je proxy přesměrovávala na /login, takže
  // se třeba logo v hlavičce/na přihlašovací stránce nikdy nenačetlo.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/exchange-rate|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|mjs|pdf)$).*)",
  ],
};
