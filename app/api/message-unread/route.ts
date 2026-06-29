import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const unreadCount = await prisma.message.count({
			where: {
				recipientId: session.user.id,
				readAt: null,
			},
		});

		return NextResponse.json({ unreadCount });
	} catch {
		return serverError("Failed to fetch unread message count");
	}
}
