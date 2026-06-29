import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, context: RouteContext) {
	try {
		const { userId } = await context.params;

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { image: true },
		});

		if (!user?.image) {
			return new NextResponse(null, { status: 404 });
		}

		if (user.image.startsWith("data:")) {
			const [metadata, base64Data] = user.image.split(",");
			const contentType = metadata.split(":")[1].split(";")[0];
			const buffer = Buffer.from(base64Data, "base64");

			return new NextResponse(new Uint8Array(buffer), {
				headers: {
					"Content-Type": contentType,
					"Cache-Control": "public, max-age=86400",
				},
			});
		}

		// If it's a URL (e.g. Google image), we can redirect or fetch and serve
		return NextResponse.redirect(user.image);
	} catch (error) {
		console.error("[AVATAR_GET_ERROR]", error);
		return new NextResponse(null, { status: 500 });
	}
}
