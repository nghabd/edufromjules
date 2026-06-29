"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { formatDistanceToNow } from "date-fns";

type Notification = {
	id: string;
	title: string;
	message: string;
	type: string;
	read: boolean;
	createdAt: string;
};

type NotificationsData = {
	notifications: Notification[];
	unreadCount: number;
};

const typeColors: Record<string, string> = {
	SUCCESS: "bg-green-500",
	ERROR: "bg-red-500",
	WARNING: "bg-amber-500",
	INFO: "bg-blue-500",
};

export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	useRealtimeQueryInvalidation({
		events: [REALTIME_EVENTS.notificationCreated, REALTIME_EVENTS.pharmacistChanged, REALTIME_EVENTS.assignmentChanged, REALTIME_EVENTS.certificateIssued],
		queryKeys: [["notifications"]],
	});

	const { data } = useQuery<NotificationsData>({
		queryKey: ["notifications"],
		queryFn: async () => (await axios.get("/api/notifications")).data,
		refetchInterval: 30_000,
	});

	const markRead = useMutation({
		mutationFn: async (id?: string) =>
			axios.patch("/api/notifications", id ? { id } : { markAll: true }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const clearRead = useMutation({
		mutationFn: async () => axios.delete("/api/notifications"),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	// Close on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const unreadCount = data?.unreadCount ?? 0;
	const notifications = data?.notifications ?? [];

	return (
		<div className="relative" ref={ref}>
			<Button
				variant="ghost"
				size="sm"
				className="relative p-2"
				onClick={() => {
					setOpen((v) => !v);
				}}
				aria-label="Notifications"
			>
				<Bell className="h-5 w-5" />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
						{unreadCount > 99 ? "99+" : unreadCount}
					</span>
				)}
			</Button>

			{open && (
				<div className="absolute right-0 top-full mt-2 w-96 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
					{/* Header */}
					<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
						<div className="flex items-center gap-2">
							<Bell className="h-4 w-4 text-blue-600" />
							<span className="font-semibold text-sm text-slate-900 dark:text-white">
								Notifications
							</span>
							{unreadCount > 0 && (
								<Badge className="bg-blue-600 text-white text-xs px-1.5 py-0">
									{unreadCount}
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-1">
							{unreadCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
									onClick={() => markRead.mutate(undefined)}
								>
									<CheckCheck className="h-3.5 w-3.5 mr-1" />
									Mark all read
								</Button>
							)}
							{notifications.some((n) => n.read) && (
								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs text-slate-500 hover:text-red-600"
									onClick={() => clearRead.mutate()}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							)}
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={() => setOpen(false)}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>

					{/* List */}
					<div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
						{notifications.length === 0 ? (
							<div className="py-12 text-center">
								<Bell className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
								<p className="text-sm text-slate-500 dark:text-slate-400">
									No notifications yet
								</p>
							</div>
						) : (
							notifications.map((n) => (
								<button
									key={n.id}
									className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex gap-3 ${
										!n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
									}`}
									onClick={() => {
										if (!n.read) markRead.mutate(n.id);
									}}
								>
									<span
										className={`mt-1.5 flex-shrink-0 h-2.5 w-2.5 rounded-full ${typeColors[n.type] ?? "bg-slate-400"}`}
									/>
									<div className="flex-1 min-w-0">
										<p
											className={`text-sm font-medium leading-tight ${
												!n.read
													? "text-slate-900 dark:text-white"
													: "text-slate-600 dark:text-slate-400"
											}`}
										>
											{n.title}
										</p>
										<p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed">
											{n.message}
										</p>
										<p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
											{formatDistanceToNow(new Date(n.createdAt), {
												addSuffix: true,
											})}
										</p>
									</div>
									{!n.read && (
										<span className="flex-shrink-0 mt-2 h-2 w-2 rounded-full bg-blue-500" />
									)}
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
