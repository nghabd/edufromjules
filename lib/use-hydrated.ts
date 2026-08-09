"use client";

import { useSyncExternalStore } from "react";

function emptySubscribe() {
	return () => {};
}

/**
 * Returns false on the server and on the first client render, and true once
 * hydration has completed. Use this to avoid server/client hydration
 * mismatches for values that depend on the browser environment.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);
}