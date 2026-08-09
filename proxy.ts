import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { canAccessRoute, isProtectedRoute } from "@/lib/auth-routing";
import { applyCsp } from "@/lib/csp";
import { isAllowedOrigin } from "@/lib/origins";

function handleApiCors(request: NextRequest): NextResponse | null {
	if (!request.nextUrl.pathname.startsWith("/api/")) {
		return null;
	}

	const origin = request.headers.get("origin");
	if (request.method === "OPTIONS") {
		const response = new NextResponse(null, { status: 204 });
		if (origin && isAllowedOrigin(origin)) {
			response.headers.set("Access-Control-Allow-Origin", origin);
			response.headers.set("Access-Control-Allow-Credentials", "true");
			response.headers.set(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, PATCH, OPTIONS",
			);
			response.headers.set(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization, X-CSRF-Token",
			);
			response.headers.set("Access-Control-Max-Age", "86400");
		}
		return response;
	}

	return null;
}

const authMiddleware = withAuth(
	function middleware(req: NextRequestWithAuth) {
		const token = req.nextauth.token;
		const path = req.nextUrl.pathname;
		const role = token?.role as string | undefined;

		if (role && !canAccessRoute(path, role)) {
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
	const apiCorsResponse = handleApiCors(request);
	if (apiCorsResponse) {
		return apiCorsResponse;
	}

	const nonce = Buffer.from(randomBytes(16)).toString("base64");
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);

	const path = request.nextUrl.pathname;

	if (isProtectedRoute(path)) {
		const requestWithNonce = new NextRequest(request.url, {
			headers: requestHeaders,
		});
		return authMiddleware(requestWithNonce as NextRequestWithAuth, event);
	}

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});
	return applyCsp(response, nonce);
}

// export const config = {
// 	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
// };
export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
