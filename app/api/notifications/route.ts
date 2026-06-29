import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";

export async function GET() {
	try {
		const { error, session } = await requireRole(["ADMIN", "SUPERVISOR", "PHARMACIST"]);
		if (error) return error;

		const notifications = await prisma.notification.findMany({
			where: { userId: session.user.id },
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		const unreadCount = notifications.filter((n) => !n.read).length;

		return NextResponse.json({ notifications, unreadCount });
	} catch {
		return serverError("Failed to fetch notifications");
	}
}

export async function PATCH(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["ADMIN", "SUPERVISOR", "PHARMACIST"]);
		if (error) return error;

		const body = await req.json().catch(() => ({}));
		const { id, markAll } = body as { id?: string; markAll?: boolean };

		if (markAll) {
			await prisma.notification.updateMany({
				where: { userId: session.user.id, read: false },
				data: { read: true },
			});
			return NextResponse.json({ success: true });
		}

		if (id) {
			await prisma.notification.updateMany({
				where: { id, userId: session.user.id },
				data: { read: true },
			});
			return NextResponse.json({ success: true });
		}

		return NextResponse.json({ message: "No action specified" }, { status: 400 });
	} catch {
		return serverError("Failed to update notifications");
	}
}

export async function DELETE(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole(["ADMIN", "SUPERVISOR", "PHARMACIST"]);
		if (error) return error;

		await prisma.notification.deleteMany({
			where: { userId: session.user.id, read: true },
		});

		return NextResponse.json({ success: true });
	} catch {
		return serverError("Failed to clear notifications");
	}
}
