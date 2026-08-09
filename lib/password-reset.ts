import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_TOKEN_MINUTES = 30;

const TOKEN_BYTES = 32;

export function hashPasswordResetToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function getAppBaseUrl(): string {
	const configuredUrl =
		process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
	const trimmedUrl = configuredUrl.trim().replace(/\/$/, "");

	if (trimmedUrl) {
		try {
			return new URL(trimmedUrl).toString().replace(/\/$/, "");
		} catch {
			console.warn("[PASSWORD_RESET_URL_INVALID]", {
				value: "NEXT_PUBLIC_APP_URL/NEXTAUTH_URL",
			});
		}
	}

	return "http://localhost:3000";
}

export function buildPasswordResetUrl(token: string): string {
	const url = new URL("/reset-password", getAppBaseUrl());
	url.searchParams.set("token", token);
	return url.toString();
}

export async function createPasswordResetToken(userId: string) {
	const now = new Date();
	const token = randomBytes(TOKEN_BYTES).toString("base64url");
	const tokenHash = hashPasswordResetToken(token);
	const expiresAt = new Date(
		now.getTime() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000,
	);

	await prisma.passwordResetToken.deleteMany({
		where: {
			OR: [{ userId }, { expiresAt: { lte: now } }],
		},
	});

	await prisma.passwordResetToken.create({
		data: {
			userId,
			tokenHash,
			expiresAt,
		},
	});

	return {
		token,
		expiresAt,
		resetUrl: buildPasswordResetUrl(token),
	};
}
