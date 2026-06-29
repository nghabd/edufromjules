import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function messageContactsWhere(
	userId: string,
	role: Role,
): Promise<Prisma.UserWhereInput> {
	const base: Prisma.UserWhereInput = { id: { not: userId } };

	if (role === "PHARMACIST") {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { supervisorId: true },
		});
		const or: Prisma.UserWhereInput[] = [{ role: "ADMIN" }];
		if (user?.supervisorId) {
			or.push({ id: user.supervisorId });
		}
		return { ...base, OR: or };
	}

	if (role === "SUPERVISOR") {
		return {
			...base,
			OR: [
				{ role: "ADMIN" },
				{
					role: "PHARMACIST",
					OR: [
						{ supervisorId: userId },
						{ group: { supervisorId: userId } },
					],
				},
			],
		};
	}

	return base;
}

export async function canUsersMessage(
	sender: { id: string; role: string },
	recipientId: string,
): Promise<boolean> {
	if (sender.id === recipientId) return false;

	const recipient = await prisma.user.findUnique({
		where: { id: recipientId },
		select: { id: true, role: true },
	});
	if (!recipient) return false;
	if (sender.role === "PHARMACIST" && recipient.role === "PHARMACIST") {
		return false;
	}

	const allowed = await prisma.user.findFirst({
		where: {
			id: recipientId,
			...(await messageContactsWhere(sender.id, sender.role as Role)),
		},
		select: { id: true },
	});

	return Boolean(allowed);
}
