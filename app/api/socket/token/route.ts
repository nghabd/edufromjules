import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { sign } from "jsonwebtoken";
import { authOptions } from "@/lib/auth";

export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id || !session.user.role) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const secret = process.env.NEXTAUTH_SECRET;
	if (!secret) {
		return NextResponse.json(
			{ message: "Server configuration error" },
			{ status: 500 },
		);
	}

	const token = sign(
		{
			id: session.user.id,
			role: session.user.role,
			type: "socket",
		},
		secret,
		{ expiresIn: "5m" },
	);

	return NextResponse.json({ token });
}
