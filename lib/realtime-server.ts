import PusherServer from "pusher";
import { logger } from "@/lib/logger";
import {
	REALTIME_CHANNEL,
	REALTIME_EVENTS,
	type RealtimeEvent,
} from "@/lib/realtime-events";

let pusherServer: PusherServer | null = null;
const REALTIME_PUBLISH_TIMEOUT_MS = 3000;

function getPusherServer() {
	const appId = process.env.PUSHER_APP_ID;
	const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
	const secret = process.env.PUSHER_SECRET;
	const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

	if (!appId || !key || !secret || !cluster) {
		return null;
	}

	if (!pusherServer) {
		pusherServer = new PusherServer({
			appId,
			key,
			secret,
			cluster,
			useTLS: true,
		});
	}

	return pusherServer;
}

export async function publishRealtimeEvent(
	event: RealtimeEvent,
	payload: Record<string, unknown> = {},
) {
	const server = getPusherServer();
	if (!server) return;

	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			server.trigger(REALTIME_CHANNEL, event, {
				...payload,
				timestamp: Date.now(),
			}),
			new Promise((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error("Realtime publish timed out")),
					REALTIME_PUBLISH_TIMEOUT_MS,
				);
			}),
		]);
	} catch (error) {
		logger.warn("[REALTIME_EVENT_FAILED]", {
			event,
			error: (error as Error).message,
		});
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

export async function publishDashboardRefresh(
	events: RealtimeEvent[] = [
		REALTIME_EVENTS.adminChanged,
		REALTIME_EVENTS.supervisorChanged,
		REALTIME_EVENTS.pharmacistChanged,
	],
) {
	await Promise.all(events.map((event) => publishRealtimeEvent(event)));
}
