/**
 * Resolve the current client origin for websocket and cross-origin connections.
 */
export function getClientAppOrigin(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
