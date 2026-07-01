import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ message: "No session" }, { status: 401 });

        const userCount = await prisma.user.count();
        const courseCount = await prisma.course.count();
        const firstUser = await prisma.user.findFirst({ select: { id: true, email: true, role: true } });

        return NextResponse.json({
            status: "ok",
            counts: { users: userCount, courses: courseCount },
            sampleUser: firstUser,
            env: {
                nodeEnv: process.env.NODE_ENV,
                databaseUrlSet: !!process.env.DATABASE_URL
            }
        });
    } catch (err: any) {
        return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
    }
}
