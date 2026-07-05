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

	// Generate a unique nonce for CSP
	const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
	const isDev = process.env.NODE_ENV === "development";

	// Construct strict CSP header
	const cspHeader = `
		default-src 'self';
		script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""};
		style-src 'self' 'nonce-${nonce}';
		img-src 'self' data: blob: https:;
		font-src 'self';
		object-src 'none';
		base-uri 'self';
		form-action 'self';
		frame-ancestors 'none';
		upgrade-insecure-requests;
	`.replace(/\s{2,}/g, " ").trim();

	// Forward nonce to request headers
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("Content-Security-Policy", cspHeader);

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
		const cookieName = process.env.NODE_ENV === "production" ? "__Secure-s" : "s";

		const token = await getToken({
			req,
			secret: process.env.NEXTAUTH_SECRET,
			cookieName,
		});

		if (!token) {
			const url = new URL("/login", req.url);
			url.searchParams.set("callbackUrl", path);
			return NextResponse.redirect(url, { headers: requestHeaders });
		}

		// Role-based access control
		if (path.startsWith("/admin") && token.role !== "ADMIN") {
			return NextResponse.redirect(new URL("/unauthorized", req.url), { headers: requestHeaders });
		}

		if (
			path.startsWith("/supervisor") &&
			token.role !== "SUPERVISOR" &&
			token.role !== "ADMIN"
		) {
			return NextResponse.redirect(new URL("/unauthorized", req.url), { headers: requestHeaders });
		}

		if (path.startsWith("/pharmacist") && token.role !== "PHARMACIST") {
			return NextResponse.redirect(new URL("/unauthorized", req.url), { headers: requestHeaders });
		}
	}

	const response = NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});

	// Set CSP header in response
	response.headers.set("Content-Security-Policy", cspHeader);

	// Explicitly clear legacy cookies on every response to help users recover
	legacyCookies.forEach((name) => {
		if (req.cookies.has(name)) {
			response.cookies.set(name, "", { maxAge: 0, path: "/" });
		}
	});

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		{
			source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
	],
};
