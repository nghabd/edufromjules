import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { badRequest, requireRole, serverError } from "@/lib/api-auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { validatePassword, ValidationError } from "@/lib/validation";

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

		const limit = await rateLimit(`account-password:${session.user.id}`, {
			windowMs: 15 * 60 * 1000,
			maxRequests: 8,
		});

		if (!limit.success) {
			return NextResponse.json(
				{ message: "Too many password attempts. Please try again later." },
				{
					status: 429,
					headers: { "Retry-After": String(limit.retryAfter) },
				},
			);
		}

		const body = await req.json().catch(() => null);
		if (!body || typeof body !== "object") {
			return badRequest("Invalid request body");
		}

		const currentPassword = String(
			(body as { currentPassword?: unknown }).currentPassword ?? "",
		);

		if (!currentPassword) {
			return badRequest("Current password is required.");
		}

		let newPassword: string;
		try {
			newPassword = validatePassword(
				(body as { newPassword?: unknown }).newPassword as string,
			);
		} catch (validationError) {
			if (validationError instanceof ValidationError) {
				return badRequest(validationError.message);
			}
			return badRequest("Invalid new password.");
		}

		if (currentPassword === newPassword) {
			return badRequest("New password must be different from current password.");
		}

		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { id: true, password: true },
		});

		if (!user?.password) {
			return badRequest("Password login is not enabled for this account.");
		}

		const currentPasswordValid = await bcrypt.compare(
			currentPassword,
			user.password,
		);

		if (!currentPasswordValid) {
			return badRequest("Current password is incorrect.");
		}

		const hashedPassword = await bcrypt.hash(newPassword, 12);

		await prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword },
		});

		await createNotification({
			userId: user.id,
			title: "Password updated",
			message: "Your account password was changed successfully.",
			type: "SUCCESS",
		});

		return NextResponse.json({
			message: "Password updated successfully.",
		});
	} catch (error) {
		console.error("[ACCOUNT_PASSWORD_ERROR]", error);
		return serverError("Password could not be updated.");
	}
}
