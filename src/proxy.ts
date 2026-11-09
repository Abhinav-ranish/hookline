import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "hookline_key";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

// The public URL can spend OpenAI and Apify credit, so it stays locked unless a key is set and presented.
export function proxy(request: NextRequest) {
  const key = process.env.ACCESS_KEY;
  if (!key) return LOCAL_HOSTS.has(request.nextUrl.hostname) ? NextResponse.next() : new NextResponse("ACCESS_KEY is not configured.", { status: 503 });
  if (request.cookies.get(COOKIE)?.value === key) return NextResponse.next();
  if (request.nextUrl.searchParams.get("key") === key) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("key");
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE, key, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 60 * 60 * 24 * 90 });
    return response;
  }
  return new NextResponse("Open your private Hookline link to sign in.", { status: 401 });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
