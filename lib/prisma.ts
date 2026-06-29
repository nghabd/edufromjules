import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
	prismaShutdownHook: boolean | undefined;
};

function createPrismaClient() {
	return new PrismaClient({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
		errorFormat: "minimal",
	});
}

export function getPrisma() {
	if (!globalForPrisma.prisma) {
		globalForPrisma.prisma = createPrismaClient();
	}

	return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
	get(_target, prop, receiver) {
		const client = getPrisma();
		const value = Reflect.get(client, prop, receiver);
		return typeof value === "function" ? value.bind(client) : value;
	},
});

// Graceful shutdown without creating a client during build-time imports.
if (typeof window === "undefined" && !globalForPrisma.prismaShutdownHook) {
	globalForPrisma.prismaShutdownHook = true;
	process.on("beforeExit", async () => {
		if (globalForPrisma.prisma) {
			await globalForPrisma.prisma.$disconnect();
		}
	});
}
