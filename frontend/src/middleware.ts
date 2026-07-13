import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

const authMiddleware = withAuth({
  pages: { signIn: "/login" },
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Public-repository mode intentionally bypasses user login. The backend must
  // enforce PUBLIC_REPOSITORIES_ONLY when this is enabled.
  if (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_PUBLIC_REPOSITORIES_MODE === "true"
  ) {
    return NextResponse.next();
  }

  return authMiddleware(request as Parameters<typeof authMiddleware>[0], event);
}

export const config = {
  matcher: ["/dashboard/:path*", "/repo/:path*", "/settings"],
};
