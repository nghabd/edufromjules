import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/mail";
import { publishDashboardRefresh, publishRealtimeEvent } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

type NotificationInput = {
	userId: string;
	title: string;
	message: string;
	type?: string;
	email?: boolean;
};

type TransactionClient = Prisma.TransactionClient;

export async function createNotification(
	input: NotificationInput,
	tx?: TransactionClient,
) {
	const client = tx ?? prisma;
	const notification = await client.notification.create({
		data: {
			userId: input.userId,
			title: input.title,
			message: input.message,
			type: input.type ?? "INFO",
		},
	});

	if (!tx) {
		await publishRealtimeEvent(REALTIME_EVENTS.notificationCreated, {
			userId: input.userId,
			notificationId: notification.id,
		});
	}

	if (input.email) {
		const user = await prisma.user.findUnique({
			where: { id: input.userId },
			select: { email: true, name: true },
		});
		if (user?.email) {
			await sendNotificationEmail({
				to: user.email,
				name: user.name,
				title: input.title,
				message: input.message,
			});
		}
	}

	return notification;
}

export async function publishNotificationRefresh() {
	await publishDashboardRefresh([
		REALTIME_EVENTS.notificationCreated,
		REALTIME_EVENTS.adminChanged,
		REALTIME_EVENTS.supervisorChanged,
		REALTIME_EVENTS.pharmacistChanged,
	]);
}
