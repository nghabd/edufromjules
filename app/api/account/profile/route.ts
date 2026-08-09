import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireRole, serverError } from "@/lib/api-auth";
import { getAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";

const profileUpdateSchema = z.object({
	name: z.string().trim().min(2).max(100).optional().or(z.literal("")),
	phoneNumber: z.string().trim().max(50).optional().or(z.literal("")),
	licenseNumber: z.string().trim().max(100).optional().or(z.literal("")),
	specialization: z.string().trim().max(120).optional().or(z.literal("")),
	yearsOfExperience: z.coerce.number().int().min(0).max(80).optional().nullable(),
	pharmacyName: z.string().trim().max(160).optional().or(z.literal("")),
	address: z.string().trim().max(240).optional().or(z.literal("")),
	bio: z.string().trim().max(1000).optional().or(z.literal("")),
});

function emptyToNull(value: string | undefined) {
	return value?.trim() ? value.trim() : null;
}

export async function GET() {
	try {
		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				image: true,
				supervisor: {
					select: { id: true, name: true, email: true, image: true },
				},
				group: {
					select: {
						name: true,
						supervisor: {
							select: { id: true, name: true, email: true, image: true },
						},
					},
				},
				profile: true,
			},
		});

		if (!user) {
			return NextResponse.json({ message: "Profile not found." }, { status: 404 });
		}

		const supervisor = user.supervisor ?? user.group?.supervisor ?? null;

		return NextResponse.json({
			profile: {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				image: getAvatarUrl(user.id, user.image),
				groupName: user.group?.name ?? null,
				details: user.profile,
				supervisor: supervisor
					? {
							...supervisor,
							image: getAvatarUrl(supervisor.id, supervisor.image),
						}
					: null,
			},
		});
	} catch {
		return serverError("Failed to fetch account profile.");
	}
}

export async function PATCH(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const { error, session } = await requireRole([
			"ADMIN",
			"SUPERVISOR",
			"PHARMACIST",
		]);
		if (error) return error;

		const body = await req.json().catch(() => null);
		const parsed = profileUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return badRequest("Invalid profile payload.", parsed.error.flatten());
		}

		const name =
			parsed.data.name === undefined ? undefined : emptyToNull(parsed.data.name);

		const [user, profile] = await prisma.$transaction([
			prisma.user.update({
				where: { id: session.user.id },
				data: name === undefined ? {} : { name },
				select: { id: true, name: true, email: true, image: true, role: true },
			}),
			prisma.profile.upsert({
				where: { userId: session.user.id },
				update: {
					phoneNumber: emptyToNull(parsed.data.phoneNumber),
					licenseNumber: emptyToNull(parsed.data.licenseNumber),
					specialization: emptyToNull(parsed.data.specialization),
					yearsOfExperience: parsed.data.yearsOfExperience ?? null,
					pharmacyName: emptyToNull(parsed.data.pharmacyName),
					address: emptyToNull(parsed.data.address),
					bio: emptyToNull(parsed.data.bio),
				},
				create: {
					userId: session.user.id,
					phoneNumber: emptyToNull(parsed.data.phoneNumber),
					licenseNumber: emptyToNull(parsed.data.licenseNumber),
					specialization: emptyToNull(parsed.data.specialization),
					yearsOfExperience: parsed.data.yearsOfExperience ?? null,
					pharmacyName: emptyToNull(parsed.data.pharmacyName),
					address: emptyToNull(parsed.data.address),
					bio: emptyToNull(parsed.data.bio),
				},
			}),
		]);

		return NextResponse.json({
			profile: {
				...user,
				image: getAvatarUrl(user.id, user.image),
				details: profile,
			},
		});
	} catch {
		return serverError("Failed to update account profile.");
	}
}
