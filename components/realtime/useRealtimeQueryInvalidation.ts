"use client";

import { useEffect } from "react";
import {
	type QueryKey,
	useQueryClient,
} from "@tanstack/react-query";
import {
	getRealtimeClient,
	REALTIME_CHANNEL,
	REALTIME_EVENTS,
} from "@/lib/realtime-client";

type EventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export function useRealtimeQueryInvalidation({
	events,
	queryKeys,
	enabled = true,
}: {
	events: EventName[];
	queryKeys: QueryKey[];
	enabled?: boolean;
}) {
	const queryClient = useQueryClient();
	const eventKey = events.join("|");
	const queryKey = queryKeys.map((key) => JSON.stringify(key)).join("|");

	useEffect(() => {
		if (!enabled) return;

		const realtimeClient = getRealtimeClient();
		if (!realtimeClient) return;

		const channel = realtimeClient.subscribe(REALTIME_CHANNEL);
		const invalidate = () => {
			for (const key of queryKeys) {
				void queryClient.invalidateQueries({ queryKey: key });
			}
		};

		for (const event of events) {
			channel.bind(event, invalidate);
		}

		return () => {
			for (const event of events) {
				channel.unbind(event, invalidate);
			}
			realtimeClient.unsubscribe(REALTIME_CHANNEL);
		};
		// queryKey/eventKey keep dependency checks stable for array literals.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, eventKey, queryKey, queryClient]);
}
