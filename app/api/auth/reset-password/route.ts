import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-auth";
import { hashPasswordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin, getClientIp } from "@/lib/request-security";
import { validatePassword, ValidationError } from "@/lib/validation";

class InvalidResetTokenError extends Error {
	constructor() {
		super("Reset link is invalid or expired.");
		this.name = "InvalidResetTokenError";
	}
}

function tooManyRequests(resetIn?: number) {
	return NextResponse.json(
		{
			message: "Too many password reset attempts. Please try again later.",
			resetIn,
		},
		{
			status: 429,
			headers: resetIn ? { "Retry-After": String(resetIn) } : undefined,
		},
	);
}

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		const ip = getClientIp(req);
		const resetLimit = await rateLimit(`reset-password:ip:${ip}`, {
			windowMs: 15 * 60 * 1000,
			maxRequests: 8,
		});

		if (!resetLimit.success) {
			return tooManyRequests(resetLimit.resetIn);
		}

		const body = await req.json().catch(() => null);
		if (!body || typeof body !== "object") {
			return badRequest("Invalid request body");
		}

		const token =
			typeof (body as { token?: unknown }).token === "string"
				? ((body as { token: string }).token || "").trim()
				: "";

		if (!token) {
			return badRequest("Reset link is invalid or expired.");
		}

		let password: string;
		try {
			password = validatePassword(
				(body as { password?: unknown }).password as string,
			);
		} catch (error) {
			if (error instanceof ValidationError) {
				return badRequest(error.message);
			}
			return badRequest("Invalid password");
		}

		const now = new Date();
		const tokenHash = hashPasswordResetToken(token);
		const resetToken = await prisma.passwordResetToken.findUnique({
			where: { tokenHash },
			select: {
				id: true,
				userId: true,
				expiresAt: true,
				usedAt: true,
			},
		});

		if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
			return badRequest("Reset link is invalid or expired.");
		}

		const hashedPassword = await bcrypt.hash(password, 12);

		await prisma.$transaction(async (tx) => {
			const tokenUpdate = await tx.passwordResetToken.updateMany({
				where: {
					id: resetToken.id,
					usedAt: null,
					expiresAt: { gt: now },
				},
				data: {
					usedAt: now,
				},
			});

			if (tokenUpdate.count !== 1) {
				throw new InvalidResetTokenError();
			}

			await tx.user.update({
				where: { id: resetToken.userId },
				data: { password: hashedPassword },
			});

			await tx.passwordResetToken.deleteMany({
				where: {
					userId: resetToken.userId,
					id: { not: resetToken.id },
				},
			});
		});

		return NextResponse.json({
			message: "Password reset successfully. You can now sign in.",
		});
	} catch (error) {
		if (error instanceof InvalidResetTokenError) {
			return badRequest(error.message);
		}

		console.error("[RESET_PASSWORD_ERROR]", error);
		return serverError("Password could not be reset.");
	}
}
