import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/supervisor", "/pharmacist"];

function isProtectedRoute(path: string) {
	if (path.startsWith("/pharmacist/approve")) return false;
	return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

const authMiddleware = withAuth(
	function middleware(req: NextRequestWithAuth) {
		const token = req.nextauth.token;
		const path = req.nextUrl.pathname;

		if (path.startsWith("/admin") && token?.role !== "ADMIN") {
			return NextResponse.redirect(new URL("/unauthorized", req.url));
		}

		if (
			path.startsWith("/supervisor") &&
			token?.role !== "SUPERVISOR" &&
			token?.role !== "ADMIN"
		) {
			return NextResponse.redirect(new URL("/unauthorized", req.url));
		}

		if (path.startsWith("/pharmacist") && token?.role !== "PHARMACIST") {
			return NextResponse.redirect(new URL("/unauthorized", req.url));
		}

		return NextResponse.next();
	},
	{
		callbacks: {
			authorized: ({ token }: { token: JWT | null }) => !!token,
		},
	},
);

export default async function middleware(
	request: NextRequest,
	event: NextFetchEvent,
) {
	const path = request.nextUrl.pathname;
	const isProtected = isProtectedRoute(path);

	if (isProtected) {
		return authMiddleware(
			request as NextRequestWithAuth,
			event,
		);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
