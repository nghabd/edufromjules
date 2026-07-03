import { NextResponse } from "next/server";

export function buildCspHeader(nonce: string): string {
	const isDev = process.env.NODE_ENV === "development";

	return [
		"default-src 'self'",
		isDev
			? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
			: `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"media-src 'self' blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' https: wss:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		!isDev ? "upgrade-insecure-requests" : "",
	]
		.filter(Boolean)
		.join("; ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

export function applyCsp(response: NextResponse, nonce: string): NextResponse {
	response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
	response.headers.set("x-nonce", nonce);
	response.headers.set("X-Frame-Options", "SAMEORIGIN");
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(self)",
	);
	return response;
}
