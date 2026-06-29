import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-auth";
import {
	createPasswordResetToken,
	PASSWORD_RESET_TOKEN_MINUTES,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin, getClientIp } from "@/lib/request-security";
import { sendPasswordResetEmail } from "@/lib/mail";
import { validateEmail, ValidationError } from "@/lib/validation";

const SUCCESS_MESSAGE =
	"If an account exists for that email, we sent a password reset link.";

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
		const ipLimit = await rateLimit(`forgot-password:ip:${ip}`, {
			windowMs: 15 * 60 * 1000,
			maxRequests: 10,
		});

		if (!ipLimit.success) {
			return tooManyRequests(ipLimit.resetIn);
		}

		const body = await req.json().catch(() => null);
		if (!body || typeof body !== "object") {
			return badRequest("Invalid request body");
		}

		let email: string;
		try {
			email = validateEmail((body as { email?: unknown }).email as string);
		} catch (error) {
			if (error instanceof ValidationError) {
				return badRequest(error.message);
			}
			return badRequest("Invalid email address");
		}

		const emailLimit = await rateLimit(`forgot-password:email:${email}`, {
			windowMs: 15 * 60 * 1000,
			maxRequests: 3,
		});

		if (!emailLimit.success) {
			return tooManyRequests(emailLimit.resetIn);
		}

		const user = await prisma.user.findUnique({
			where: { email },
			select: {
				id: true,
				email: true,
				name: true,
			},
		});

		if (!user) {
			return NextResponse.json({ message: SUCCESS_MESSAGE });
		}

		const { resetUrl } = await createPasswordResetToken(user.id);

		await sendPasswordResetEmail({
			to: user.email,
			name: user.name,
			resetUrl,
			expiresMinutes: PASSWORD_RESET_TOKEN_MINUTES,
		});

		return NextResponse.json({ message: SUCCESS_MESSAGE });
	} catch (error) {
		console.error("[FORGOT_PASSWORD_ERROR]", error);
		return serverError("Password reset email could not be sent.");
	}
}
