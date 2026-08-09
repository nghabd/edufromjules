import { NextResponse } from "next/server";
import { requireRole, serverError } from "@/lib/api-auth";
import { getAvatarUrl } from "@/lib/avatar";
import { messageContactsWhere } from "@/lib/messaging-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const users = await prisma.user.findMany({
			where: await messageContactsWhere(session.user.id, session.user.role),
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				image: true,
			},
			orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
		});

		const contacts = users.map((user) => ({
			...user,
			image: getAvatarUrl(user.id, user.image),
		}));

		return NextResponse.json({ contacts });
	} catch {
		return serverError("Failed to fetch message contacts");
	}
}
