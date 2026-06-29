/**
 * API Security Middleware
 * Provides comprehensive security checks for all API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "./env";
import { logger } from "./logger";

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS: Record<string, string> = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"X-XSS-Protection": "1; mode=block",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "geolocation=(self), microphone=(), camera=()",
};

/**
 * CORS configuration
 */
export function getCORSHeaders(origin: string | null): Record<string, string> {
	const env = getEnv();
	const allowedOrigins = env.allowedOrigins || [];

	if (!origin) {
		return {};
	}

	const isAllowed = allowedOrigins.some((allowed) => {
		// Exact match or wildcard (for development)
		if (allowed === "*") return true;
		if (!origin) return false;

		const normalizedAllowed = allowed.endsWith("/") ? allowed.slice(0, -1) : allowed;
		const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;

		if (normalizedAllowed === normalizedOrigin) return true;

		// Protocol-agnostic match for trusted origins
		const allowedBase = normalizedAllowed.replace(/^https?:\/\//, "");
		const originBase = normalizedOrigin.replace(/^https?:\/\//, "");
		if (allowedBase === originBase) {
			return true;
		}

		// Handle wildcards like *.example.com
		if (allowed.startsWith("*.")) {
			const pattern = allowed.substring(2);
			try {
				const originHost = new URL(origin).hostname;
				return originHost.endsWith(pattern);
			} catch {
				return false;
			}
		}

		return false;
	});

	if (!isAllowed) {
		logger.warn("[CORS_BLOCKED]", { origin, allowedOrigins });
		return {};
	}

	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
		"Access-Control-Max-Age": "86400",
	};
}

/**
 * Validate request origin for CORS
 */
export function validateOrigin(req: NextRequest): boolean {
	const origin = req.headers.get("origin");
	if (!origin) return true; // Allow requests without origin (SSR, etc)

	const env = getEnv();
	const allowedOrigins = env.allowedOrigins || [];

	return allowedOrigins.some((allowed) => {
		if (allowed === "*") return true;
		if (allowed === origin) return true;
		if (allowed.startsWith("*.")) {
			const pattern = allowed.substring(2);
			return origin.endsWith(pattern);
		}
		return false;
	});
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
	Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
		response.headers.set(key, value);
	});
	return response;
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(
	response: NextResponse,
	request: NextRequest,
): NextResponse {
	const origin = request.headers.get("origin");
	const corsHeaders = getCORSHeaders(origin);

	Object.entries(corsHeaders).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	return response;
}

/**
 * Create options response for CORS preflight
 */
export function createCORSResponse(request: NextRequest): NextResponse {
	const origin = request.headers.get("origin");
	const corsHeaders = getCORSHeaders(origin);

	return addSecurityHeaders(
		new NextResponse(null, {
			status: 200,
			headers: corsHeaders,
		}),
	);
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
	return input
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;")
		.replace(/\//g, "&#x2F;");
}

/**
 * Sanitize object fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
	const result: Record<string, unknown> = { ...obj };

	for (const [key, value] of Object.entries(result)) {
		if (typeof value === "string") {
			result[key] = sanitizeInput(value);
		} else if (typeof value === "object" && value !== null) {
			result[key] = sanitizeObject(value as Record<string, unknown>);
		}
	}

	return result as T;
}

/**
 * Validate request content type
 */
export function validateContentType(
	req: NextRequest,
	allowedTypes: string[],
): boolean {
	const contentType =
		req.headers.get("content-type")?.split(";")[0].trim() || "";

	if (!contentType) return true; // Allow if not specified

	return allowedTypes.some((type) => contentType.includes(type));
}

/**
 * Extract client IP address
 */
export function getClientIp(req: NextRequest): string {
	return (
		req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
		req.headers.get("x-real-ip") ||
		req.headers.get("cf-connecting-ip") ||
		"unknown"
	);
}

/**
 * Create API response with consistent format
 */
export function createAPIResponse<T>(
	data: T,
	status: number = 200,
	message?: string,
): NextResponse {
	const response = new NextResponse(
		JSON.stringify({
			success: status < 400,
			status,
			message,
			data,
			timestamp: new Date().toISOString(),
		}),
		{ status },
	);

	response.headers.set("Content-Type", "application/json");
	return addSecurityHeaders(response);
}

/**
 * Create error response
 */
export function createErrorResponse(
	message: string,
	status: number = 400,
	details?: unknown,
): NextResponse {
	logger.warn("[API_ERROR]", { message, status, details });

	const response = new NextResponse(
		JSON.stringify({
			success: false,
			status,
			message,
			details: process.env.NODE_ENV === "development" ? details : undefined,
			timestamp: new Date().toISOString(),
		}),
		{ status },
	);

	response.headers.set("Content-Type", "application/json");
	return addSecurityHeaders(response);
}

/**
 * Rate limiting error response
 */
export function createRateLimitResponse(retryAfter: number): NextResponse {
	const response = new NextResponse(
		JSON.stringify({
			success: false,
			status: 429,
			message: "Too many requests",
			retryAfter,
			timestamp: new Date().toISOString(),
		}),
		{ status: 429 },
	);

	response.headers.set("Retry-After", String(retryAfter));
	response.headers.set("Content-Type", "application/json");
	return addSecurityHeaders(response);
}

/**
 * Authentication error response
 */
export function createAuthErrorResponse(
	message: string = "Unauthorized",
): NextResponse {
	return createErrorResponse(message, 401);
}

/**
 * Authorization error response
 */
export function createAuthorizationErrorResponse(
	message: string = "Forbidden",
): NextResponse {
	return createErrorResponse(message, 403);
}

/**
 * Not found error response
 */
export function createNotFoundResponse(
	message: string = "Resource not found",
): NextResponse {
	return createErrorResponse(message, 404);
}
