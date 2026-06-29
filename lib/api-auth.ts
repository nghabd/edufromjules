import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export type Role = "ADMIN" | "SUPERVISOR" | "PHARMACIST";

type AuthResult =
	| { error: NextResponse; session: null }
	| { error: null; session: AuthSession };

export interface AuthenticatedRequest {
	userId: string;
	userRole: Role;
	userEmail: string;
}

interface AuthSession {
	user: {
		id: string;
		role: Role;
		email?: string | null;
	};
}

/**
 * Verify user role and optionally apply rate limiting
 * @param roles - Allowed roles
 * @param options - Configuration options
 */
export async function requireRole(
	roles: Role[],
	options?: {
		identifier?: string;
		windowMs?: number;
		maxRequests?: number;
		logAction?: boolean;
	},
): Promise<AuthResult> {
	const {
		identifier,
		windowMs = 60000,
		maxRequests = 100,
		logAction = true,
	} = options || {};

	// Apply rate limiting if identifier is provided
	if (identifier) {
		const rateLimitResult = await rateLimit(identifier, {
			windowMs,
			maxRequests,
		});

		if (!rateLimitResult.success) {
			logger.warn("[RATE_LIMITED]", {
				identifier,
				resetIn: rateLimitResult.resetIn,
			});
			return {
				error: NextResponse.json(
					{
						message: "Too many requests. Please try again later.",
						resetIn: rateLimitResult.resetIn,
					},
					{
						status: 429,
						headers: {
							"Retry-After": String(
								rateLimitResult.retryAfter || rateLimitResult.resetIn,
							),
						},
					},
				),
				session: null,
			};
		}
	}

	// Get server session
	const session = await getServerSession(authOptions);

	if (!session?.user) {
		logger.warn("[UNAUTHORIZED] No session");
		return {
			error: NextResponse.json(
				{ message: "Unauthorized. Please sign in." },
				{ status: 401 },
			),
			session: null,
		};
	}

	// Check role
	const userRole = session.user.role as Role;
	if (!roles.includes(userRole)) {
		if (logAction) {
			logger.warn("[FORBIDDEN] Insufficient permissions", {
				userRole,
				required: roles,
				userId: session.user.id,
			});
		}
		return {
			error: NextResponse.json(
				{ message: "Forbidden. Insufficient permissions." },
				{ status: 403 },
			),
			session: null,
		};
	}

	return { error: null, session: session as AuthSession };
}

/**
 * Verify admin role only
 */
export async function requireAdmin() {
	return requireRole(["ADMIN"], { logAction: true });
}

/**
 * Verify supervisor or admin role
 */
export async function requireSupervisor() {
	return requireRole(["SUPERVISOR", "ADMIN"], { logAction: true });
}

/**
 * Bad request response
 */
export function badRequest(message: string, details?: Record<string, unknown>) {
	logger.warn("[BAD_REQUEST]", { message, ...details });
	return NextResponse.json(
		{
			message,
			...(details && { details }),
		},
		{ status: 400 },
	);
}

/**
 * Not found response
 */
export function notFound(resource: string = "Resource") {
	return NextResponse.json(
		{ message: `${resource} not found.` },
		{ status: 404 },
	);
}

/**
 * Server error response
 */
export function serverError(
	message: string = "Internal server error",
	error?: Error,
) {
	if (error) {
		logger.error("[SERVER_ERROR]", {
			message,
			error: error.message,
			stack: error.stack,
		});
	} else {
		logger.error("[SERVER_ERROR]", { message });
	}
	return NextResponse.json({ message }, { status: 500 });
}

/**
 * Conflict response (e.g., duplicate resource)
 */
export function conflict(message: string) {
	logger.warn("[CONFLICT]", { message });
	return NextResponse.json({ message }, { status: 409 });
}

/**
 * Success response with data
 */
export function success<T>(data: T, status: number = 200) {
	return NextResponse.json(data, { status });
}

/**
 * Unauthorized response
 */
export function unauthorized(message: string = "Unauthorized") {
	logger.warn("[UNAUTHORIZED]", { message });
	return NextResponse.json({ message }, { status: 401 });
}

/**
 * Forbidden response
 */
export function forbidden(message: string = "Forbidden") {
	logger.warn("[FORBIDDEN]", { message });
	return NextResponse.json({ message }, { status: 403 });
}
