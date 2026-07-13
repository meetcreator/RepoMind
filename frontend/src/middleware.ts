import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

const authMiddleware = withAuth({
  pages: { signIn: "/login" },
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Demo mode is for the mock-data deployment only. Never enable it alongside
  // a backend that exposes real repositories or user data.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.next();
  }

  return authMiddleware(request as Parameters<typeof authMiddleware>[0], event);
}

export const config = {
  matcher: ["/dashboard/:path*", "/repo/:path*", "/settings"],
};
