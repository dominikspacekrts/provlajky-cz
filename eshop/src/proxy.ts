import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isProduction } from "@/lib/site";

// Dev prostředí se nesmí dostat do vyhledávačů ani do statistik kampaní.
// Na produkci tenhle soubor neudělá vůbec nic — žádná hlavička, žádný basic
// auth. Rozhoduje výhradně NEXT_PUBLIC_SITE_ENV, ne doména.

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="provlajky-dev", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function hasValidCredentials(request: NextRequest, user: string, pass: string) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false;
  }
  // Heslo může obsahovat dvojtečku, jméno ne — dělí se na prvním výskytu.
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;
  return decoded.slice(0, separator) === user && decoded.slice(separator + 1) === pass;
}

export function proxy(request: NextRequest) {
  if (isProduction()) return NextResponse.next();

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (user && pass && !hasValidCredentials(request, user, pass)) {
    return unauthorized();
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Bez matcheru by proxy běžela i na _next/static a obrázcích v public —
  // basic auth by pak blokoval CSS a JS dřív, než se stihne přihlásit.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
