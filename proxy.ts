import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const PROTECTED_PREFIXES = ["/admin", "/supervisor", "/pharmacist"];
// ddddd
function isProtectedRoute(path: string) {
	if (path.startsWith("/pharmacist/approve")) return false;
	return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function buildCspHeader(nonce: string): string {
	const isDev = process.env.NODE_ENV === "development";

	return [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : ""}`.trim(),
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"media-src 'self' blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' https:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'self'",
		!isDev ? "upgrade-insecure-requests" : "",
	]
		.filter(Boolean)
		.join("; ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function applyCsp(response: NextResponse, nonce: string): NextResponse {
	response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
	response.headers.set("X-Nonce", nonce);
	return response;
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

		const nonce = req.headers.get("x-nonce") ?? "";
		const response = NextResponse.next({
			request: { headers: req.headers },
		});
		return applyCsp(response, nonce);
	},
	{
		callbacks: {
			authorized: ({ token }: { token: JWT | null }) => !!token,
		},
	},
);

export default async function proxy(
	request: NextRequest,
	event: NextFetchEvent,
) {
	const nonce = Buffer.from(randomBytes(16)).toString("base64");
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);

	const path = request.nextUrl.pathname;
	const isProtected = isProtectedRoute(path);

	if (isProtected) {
		const requestWithNonce = new NextRequest(request.url, {
			headers: requestHeaders,
		});
		return authMiddleware(
			requestWithNonce as NextRequestWithAuth,
			event,
		);
	}

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});
	return applyCsp(response, nonce);
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
