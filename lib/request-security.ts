import { NextResponse } from "next/server";
import {
	getDeploymentOrigins,
	isAllowedOrigin,
	normalizeOrigin,
} from "@/lib/origins";

export function getAllowedOrigins(): string[] {
	return getDeploymentOrigins();
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

	const requestOrigin = normalizeOrigin(new URL(request.url).origin);
	const configuredOrigins = getAllowedOrigins();
	const allowedOrigins = [...new Set([...configuredOrigins, requestOrigin])];

	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");

	if (origin) {
		const normalizedOrigin = normalizeOrigin(origin);
		if (!isAllowedOrigin(normalizedOrigin) && !allowedOrigins.includes(normalizedOrigin)) {
			return NextResponse.json({ message: "Forbidden origin." }, { status: 403 });
		}
		return null;
	}

	if (referer) {
		try {
			const refererOrigin = normalizeOrigin(new URL(referer).origin);
			if (!isAllowedOrigin(refererOrigin) && !allowedOrigins.includes(refererOrigin)) {
				return NextResponse.json({ message: "Forbidden origin." }, { status: 403 });
			}
		} catch {
			return NextResponse.json({ message: "Invalid referer." }, { status: 403 });
		}
	}

	return null;
}
