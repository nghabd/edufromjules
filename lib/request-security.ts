import { NextResponse } from "next/server";

function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getAllowedOrigins(): string[] {
	const configured = process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
	return configured
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean)
		.map(trimTrailingSlash);
}

export function getClientIp(request: Request): string {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		const firstIp = forwardedFor.split(",")[0]?.trim();
		if (firstIp) return firstIp;
	}

	const realIp = request.headers.get("x-real-ip")?.trim();
	if (realIp) return realIp;

	return "unknown";
}

export function enforceTrustedOrigin(request: Request): NextResponse | null {
	const method = request.method.toUpperCase();
	if (["GET", "HEAD", "OPTIONS"].includes(method)) {
		return null;
	}

	const requestOrigin = trimTrailingSlash(new URL(request.url).origin);
	const configuredOrigins = getAllowedOrigins();
	const allowedOrigins = [...new Set([...configuredOrigins, requestOrigin])];

	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");

	if (origin) {
		const normalizedOrigin = trimTrailingSlash(origin);
		if (!allowedOrigins.includes(normalizedOrigin)) {
			return NextResponse.json({ message: "Forbidden origin." }, { status: 403 });
		}
		return null;
	}

	if (referer) {
		try {
			const refererOrigin = trimTrailingSlash(new URL(referer).origin);
			if (!allowedOrigins.includes(refererOrigin)) {
				return NextResponse.json({ message: "Forbidden origin." }, { status: 403 });
			}
		} catch {
			return NextResponse.json({ message: "Invalid referer." }, { status: 403 });
		}
	}

	return null;
}
