import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { enforceTrustedOrigin, getClientIp } from "@/lib/request-security";
import {
	validateEmail,
	validatePassword,
	validateName,
	ValidationError,
} from "@/lib/validation";

export async function POST(req: Request) {
	try {
		const originError = enforceTrustedOrigin(req);
		if (originError) return originError;

		// Apply rate limiting per IP
		const ip = getClientIp(req);
		const rateLimitResult = await rateLimit(`register:${ip}`, {
			windowMs: 15 * 60 * 1000, // 15 minutes
			maxRequests: 5, // Max 5 registration attempts per 15 minutes
		});

		if (!rateLimitResult.success) {
			return NextResponse.json(
				{
					message: "Too many registration attempts. Please try again later.",
					resetIn: rateLimitResult.resetIn,
				},
				{ status: 429 },
			);
		}

		// Parse and validate request body
		const body = await req.json().catch(() => null);
		if (!body) {
			return badRequest("Invalid request body");
		}

		// Extract and validate fields
		let email: string;
		let password: string;
		let name: string;

		try {
			email = validateEmail(body.email);
			password = validatePassword(body.password);
			name = validateName(body.name);
		} catch (error) {
			if (error instanceof ValidationError) {
				return badRequest(error.message);
			}
			return badRequest("Invalid input");
		}

		// Check if user already exists
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			return badRequest("An account with this email already exists.");
		}

		// Hash password with bcrypt (12 rounds)
		const hashedPassword = await bcrypt.hash(password, 12);

		// Create user with default role
		const user = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: "PHARMACIST",
			},
			select: {
				id: true,
				email: true,
				name: true,
				role: true,
				createdAt: true,
			},
		});

		return NextResponse.json(
			{
				message: "Account created successfully",
				user: user,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("[REGISTER_ERROR]", error);
		return serverError("Failed to create account");
	}
}
