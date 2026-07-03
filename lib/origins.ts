function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function normalizeOrigin(origin: string): string {
	return trimTrailingSlash(origin.trim());
}

export function originFromUrl(url: string): string | null {
	try {
		return normalizeOrigin(new URL(url).origin);
	} catch {
		return null;
	}
}

function addOrigin(origins: Set<string>, value?: string | null) {
	if (!value?.trim()) return;

	if (value.includes(",")) {
		for (const part of value.split(",")) {
			addOrigin(origins, part);
		}
		return;
	}

	const trimmed = value.trim();
	const normalized = trimmed.startsWith("http")
		? originFromUrl(trimmed)
		: originFromUrl(`https://${trimmed}`);

	if (normalized) {
		origins.add(normalized);
	}
}

/**
 * Resolve every trusted deployment origin for CORS, CSRF, and auth callbacks.
 * Includes Vercel preview/production URLs so public and preview deployments work.
 */
export function getDeploymentOrigins(): string[] {
	const origins = new Set<string>();

	addOrigin(origins, process.env.ALLOWED_ORIGINS);
	addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL);
	addOrigin(origins, process.env.NEXTAUTH_URL);
	addOrigin(origins, process.env.VERCEL_PROJECT_PRODUCTION_URL);
	addOrigin(origins, process.env.VERCEL_URL);
	addOrigin(origins, process.env.VERCEL_BRANCH_URL);

	return [...origins];
}

export function getPrimaryAppUrl(): string {
	const candidates = [
		process.env.NEXT_PUBLIC_APP_URL,
		process.env.NEXTAUTH_URL,
		process.env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
			: null,
		process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
		"http://localhost:3000",
	];

	for (const candidate of candidates) {
		const origin = candidate ? originFromUrl(candidate) : null;
		if (origin) {
			return origin;
		}
	}

	return "http://localhost:3000";
}

export function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) return true;

	const normalized = normalizeOrigin(origin);
	const allowedOrigins = getDeploymentOrigins();

	if (allowedOrigins.length === 0) {
		return process.env.NODE_ENV !== "production";
	}

	return allowedOrigins.some((allowed) => {
		if (allowed === "*") return true;
		if (allowed === normalized) return true;
		if (allowed.startsWith("*.")) {
			return normalized.endsWith(allowed.slice(1));
		}
		return false;
	});
}
