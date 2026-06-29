import { NextResponse } from "next/server";
import { requireRole, badRequest, forbidden, serverError } from "@/lib/api-auth";
import { canUsersMessage } from "@/lib/messaging-access";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishRealtimeEvent } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

async function getCurrentUser(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, role: true, name: true, email: true },
	});
}

export async function GET(req: Request) {
	try {
		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const { searchParams } = new URL(req.url);
		const recipientId = String(searchParams.get("userId") ?? "");
		if (!recipientId) return badRequest("Conversation user is required.");

		const [currentUser, recipient] = await Promise.all([
			getCurrentUser(session.user.id),
			getCurrentUser(recipientId),
		]);

		if (!currentUser || !recipient) {
			return badRequest("Conversation user not found.");
		}
		if (!(await canUsersMessage(currentUser, recipient.id))) {
			return forbidden("You cannot message this user.");
		}

	await prisma.message.updateMany({
		where: {
			senderId: recipient.id,
			recipientId: currentUser.id,
			readAt: null,
		},
		data: { readAt: new Date() },
	});

	const messages = await prisma.message.findMany({
		where: {
			OR: [
				{ senderId: currentUser.id, recipientId: recipient.id },
				{ senderId: recipient.id, recipientId: currentUser.id },
			],
		},
		orderBy: { createdAt: "asc" },
		take: 100,
		include: {
			sender: { select: { id: true, name: true, email: true, role: true } },
			recipient: { select: { id: true, name: true, email: true, role: true } },
		},
	});

	return NextResponse.json({ messages, contact: recipient });
	} catch {
		return serverError("Failed to fetch messages");
	}
}

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const { rateLimit } = await import("@/lib/rate-limit");
		const rateLimitResult = await rateLimit(req, "messages");
		if (!rateLimitResult.success) {
			return NextResponse.json(
				{ error: "Too many messages sent. Please wait." },
				{ status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
			);
		}

		const body = await req.json().catch(() => null);
		const recipientId = String(body?.recipientId ?? "");
		const text = String(body?.body ?? "").trim();

		if (!recipientId) return badRequest("Recipient is required.");
		if (!text || text.length > 2000) {
			return badRequest("Message must be between 1 and 2000 characters.");
		}

		const [currentUser, recipient] = await Promise.all([
			getCurrentUser(session.user.id),
			getCurrentUser(recipientId),
		]);

		if (!currentUser || !recipient) return badRequest("Recipient not found.");
		if (!(await canUsersMessage(currentUser, recipient.id))) {
			return forbidden("You cannot message this user.");
		}

		const message = await prisma.message.create({
			data: {
				senderId: currentUser.id,
				recipientId: recipient.id,
				body: text,
			},
			include: {
				sender: { select: { id: true, name: true, email: true, role: true } },
				recipient: { select: { id: true, name: true, email: true, role: true } },
			},
		});

		await publishRealtimeEvent(REALTIME_EVENTS.messageCreated, {
			messageId: message.id,
			senderId: currentUser.id,
			recipientId: recipient.id,
		});

		return NextResponse.json({ message }, { status: 201 });
	} catch (error) {
		return serverError("Failed to send message", error as Error);
	}
}
