import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/supervisor", "/pharmacist"];

function isProtectedRoute(path: string) {
	if (path.startsWith("/pharmacist/approve")) return false;
	return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default async function middleware(req: NextRequest) {
	const path = req.nextUrl.pathname;
	const isProtected = isProtectedRoute(path);

	// Attempt to clear legacy bloated cookies that cause 494 errors
	const legacyCookies = [
		"next-auth.session-token",
		"__Secure-next-auth.session-token",
		"next-auth.callback-url",
		"next-auth.csrf-token",
		"pharma-session-v4",
		"session-v5",
	];

	if (isProtected) {
		const token = await getToken({
			req,
			secret: process.env.NEXTAUTH_SECRET,
			cookieName: "s", // Matches the renamed cookie in lib/auth.ts
		});

		if (!token) {
			const url = new URL("/login", req.url);
			url.searchParams.set("callbackUrl", path);
			return NextResponse.redirect(url);
		}

		// Role-based access control
		if (path.startsWith("/admin") && token.role !== "ADMIN") {
			return NextResponse.redirect(new URL("/unauthorized", req.url));
		}

		if (
			path.startsWith("/supervisor") &&
			token.role !== "SUPERVISOR" &&
			token.role !== "ADMIN"
		) {
			return NextResponse.redirect(new URL("/unauthorized", req.url));
		}

		if (path.startsWith("/pharmacist") && token.role !== "PHARMACIST") {
			return NextResponse.redirect(new URL("/unauthorized", req.url));
		}
	}

	const response = NextResponse.next();

	// Explicitly clear legacy cookies on every response to help users recover
	legacyCookies.forEach((name) => {
		if (req.cookies.has(name)) {
			response.cookies.set(name, "", { maxAge: 0, path: "/" });
		}
	});

	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
