import { headers } from "next/headers";
import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function createNonce(): string {
	return randomBytes(16).toString("base64");
}

/**
 * Get the nonce from request headers (for use in components)
 */
export async function getNonce(): Promise<string | undefined> {
	const headersList = await headers();
	return headersList.get("x-nonce") ?? undefined;
}
