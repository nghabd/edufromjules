"use client";

import PusherClient from "pusher-js";
import { REALTIME_CHANNEL, REALTIME_EVENTS } from "@/lib/realtime-events";

let pusherClient: PusherClient | null = null;

export function getRealtimeClient() {
	if (typeof window === "undefined") return null;

	const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
	const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

	if (!key || !cluster) return null;

	if (!pusherClient) {
		pusherClient = new PusherClient(key, {
			cluster,
		});
	}

	return pusherClient;
}

export { REALTIME_CHANNEL, REALTIME_EVENTS };
