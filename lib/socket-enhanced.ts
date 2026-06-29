/**
 * Enhanced Real-Time Socket.io Handler
 * Provides secure, performant real-time communication with best practices
 */

import { Server as NetServer } from "http";
import { Socket as NetSocket } from "net";
import { NextApiResponse } from "next";
import { Server as SocketIOServer, Socket as IOSocket } from "socket.io";
import { verify, JwtPayload } from "jsonwebtoken";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { getEnv } from "./env";
import Redis from "ioredis";

export type NextApiResponseServerIO = NextApiResponse & {
	socket: NetSocket & {
		server: NetServer & {
			io: SocketIOServer;
		};
	};
};

export const config = {
	api: {
		bodyParser: false,
	},
};

export interface SocketData {
	userId: string;
	role: string;
	groupId?: string;
	userEmail?: string | null;
}

export interface ServerToClientEvents {
	progress: (data: {
		materialId: string;
		progress: number;
		userId: string;
	}) => void;
	notification: (data: {
		title: string;
		message: string;
		type: string;
	}) => void;
	quiz: (data: { quizId: string; score: number; passed: boolean }) => void;
	assignment: (data: { courseId: string; status: string }) => void;
	material_updated: (data: {
		materialId: string;
		title: string;
		timestamp: Date;
	}) => void;
	course_progress: (data: {
		courseId: string;
		completed: number;
		total: number;
	}) => void;
	error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
	join: (userId: string) => void;
	joinGroup: (groupId: string) => void;
	joinCourse: (courseId: string) => void;
	progressUpdate: (data: { materialId: string; progress: number }) => void;
	disconnect: () => void;
}

let io: SocketIOServer;
let redisAdapter: Parameters<SocketIOServer["adapter"]>[0] | undefined;
let pubClient: Redis;
let subClient: Redis;

/**
 * Initialize Redis adapter for distributed Socket.io
 */
async function initializeRedisAdapter() {
	const env = getEnv();
	if (!env.redisUrl) {
		logger.warn(
			"[SOCKET_REDIS] Redis URL not configured, using in-memory adapter",
		);
		return;
	}

	try {
		pubClient = new Redis(env.redisUrl);
		subClient = pubClient.duplicate();

		// Import and setup adapter
		const { createAdapter } = await import("@socket.io/redis-adapter");
		redisAdapter = createAdapter(pubClient, subClient);

		logger.info("[SOCKET_REDIS] Redis adapter initialized");
	} catch (error) {
		logger.warn("[SOCKET_REDIS_ERROR]", {
			error: (error as Error).message,
		});
	}
}

export function getIO() {
	if (!io) {
		throw new Error("Socket.io not initialized");
	}
	return io;
}

/**
 * Enhanced socket authentication with improved security
 */
type AuthenticatedSocket = IOSocket<
	ClientToServerEvents,
	ServerToClientEvents,
	object,
	SocketData
>;

async function authenticateSocket(
	socket: AuthenticatedSocket,
	next: (err?: Error) => void,
) {
	try {
		const token =
			socket.handshake.auth.token ||
			socket.handshake.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			logger.warn("[SOCKET_AUTH] No token provided", { socketId: socket.id });
			return next(new Error("Authentication error: No token provided"));
		}

		const secret = process.env.NEXTAUTH_SECRET;
		if (!secret) {
			logger.error("[SOCKET_AUTH] NEXTAUTH_SECRET not configured");
			return next(new Error("Server configuration error"));
		}

		let decoded: JwtPayload & { id?: string; role?: string; type?: string };
		try {
			decoded = verify(token, secret) as JwtPayload & {
				id?: string;
				role?: string;
			};
		} catch (error) {
			logger.warn("[SOCKET_AUTH] Invalid token", {
				socketId: socket.id,
				error: (error as Error).message,
			});
			return next(new Error("Authentication error: Invalid token"));
		}

		if (!decoded?.id) {
			logger.warn("[SOCKET_AUTH] Invalid token payload", {
				socketId: socket.id,
			});
			return next(new Error("Authentication error: Invalid token"));
		}

		if (decoded.type !== "socket") {
			logger.warn("[SOCKET_AUTH] Invalid token type", { socketId: socket.id });
			return next(new Error("Authentication error: Invalid token"));
		}

		// Verify user exists in database
		const user = await prisma.user.findUnique({
			where: { id: decoded.id },
			select: {
				id: true,
				role: true,
				groupId: true,
				email: true,
				emailVerified: true,
			},
		});

		if (!user) {
			logger.warn("[SOCKET_AUTH] User not found", {
				userId: decoded.id,
				socketId: socket.id,
			});
			return next(new Error("Authentication error: User not found"));
		}

		// Check email verification
		if (!user.emailVerified) {
			logger.warn("[SOCKET_AUTH] Email not verified", {
				userId: decoded.id,
				socketId: socket.id,
			});
			return next(new Error("Authentication error: Email not verified"));
		}

		// Attach user data to socket
		socket.data = {
			userId: user.id,
			role: user.role,
			groupId: user.groupId || undefined,
			userEmail: user.email,
		};

		logger.info("[SOCKET_AUTH_SUCCESS]", {
			userId: user.id,
			role: user.role,
			socketId: socket.id,
		});

		next();
	} catch (error) {
		logger.error("[SOCKET_AUTH_ERROR]", {
			error: (error as Error).message,
		});
		next(new Error("Authentication failed"));
	}
}

/**
 * Initialize Socket.io server
 */
export async function initSocket(server: NetServer) {
	// Initialize Redis adapter if available
	await initializeRedisAdapter();

	io = new SocketIOServer(server, {
		cors: {
			origin: (
				process.env.ALLOWED_ORIGINS ||
				process.env.NEXTAUTH_URL ||
				""
			).split(","),
			credentials: true,
			methods: ["GET", "POST"],
		},
		transports: ["websocket", "polling"],
		maxHttpBufferSize: 1e6, // 1MB
		pingInterval: 25000,
		pingTimeout: 60000,
		...(redisAdapter && { adapter: redisAdapter }),
	});

	// Apply authentication middleware
	io.use((socket, next) => {
		authenticateSocket(socket as AuthenticatedSocket, next);
	});

	// Connection event
	io.on("connection", (socket: AuthenticatedSocket) => {
		logger.info("[SOCKET_CONNECTED]", {
			socketId: socket.id,
			userId: socket.data?.userId,
		});

		// Join user room
		socket.on("join", (userId: string) => {
			if (userId !== socket.data.userId) {
				logger.warn("[SOCKET_UNAUTHORIZED_JOIN]", {
					socketId: socket.id,
					requestedUserId: userId,
					actualUserId: socket.data.userId,
				});
				socket.emit("error", { message: "Unauthorized" });
				return;
			}

			socket.join(`user:${userId}`);
			logger.info("[SOCKET_USER_ROOM]", {
				socketId: socket.id,
				userId,
			});
		});

		// Join group room
		socket.on("joinGroup", (groupId: string) => {
			if (socket.data.groupId !== groupId && socket.data.role !== "ADMIN") {
				logger.warn("[SOCKET_UNAUTHORIZED_GROUP_JOIN]", {
					socketId: socket.id,
					userId: socket.data.userId,
					requestedGroupId: groupId,
				});
				socket.emit("error", { message: "Unauthorized" });
				return;
			}

			socket.join(`group:${groupId}`);
			logger.info("[SOCKET_GROUP_ROOM]", {
				socketId: socket.id,
				groupId,
				userId: socket.data.userId,
			});
		});

		// Join course room
		socket.on("joinCourse", (courseId: string) => {
			socket.join(`course:${courseId}`);
			logger.info("[SOCKET_COURSE_ROOM]", {
				socketId: socket.id,
				courseId,
				userId: socket.data.userId,
			});
		});

		// Progress update
		socket.on(
			"progressUpdate",
			async (data: { materialId: string; progress: number }) => {
				try {
					if (!data.materialId || typeof data.progress !== "number") {
						socket.emit("error", { message: "Invalid progress data" });
						return;
					}

					// Validate progress is between 0 and 100
					const progress = Math.min(100, Math.max(0, data.progress));

					// Store progress in database
					await prisma.userProgress.upsert({
						where: {
							userId_materialId: {
								userId: socket.data.userId,
								materialId: data.materialId,
							},
						},
						update: {
							progress,
							lastAccessed: new Date(),
						},
						create: {
							userId: socket.data.userId,
							materialId: data.materialId,
							progress,
						},
					});

					// Broadcast to user's rooms
					io.to(`user:${socket.data.userId}`).emit("progress", {
						materialId: data.materialId,
						progress,
						userId: socket.data.userId,
					});

					logger.info("[SOCKET_PROGRESS_UPDATE]", {
						userId: socket.data.userId,
						materialId: data.materialId,
						progress,
					});
				} catch (error) {
					logger.error("[SOCKET_PROGRESS_ERROR]", {
						error: (error as Error).message,
						userId: socket.data.userId,
					});
					socket.emit("error", { message: "Failed to update progress" });
				}
			},
		);

		// Disconnect event
		socket.on("disconnect", () => {
			logger.info("[SOCKET_DISCONNECTED]", {
				socketId: socket.id,
				userId: socket.data?.userId,
			});
		});

		// Error handling
		socket.on("error", (error: Error) => {
			logger.error("[SOCKET_ERROR]", {
				error: error.message,
				socketId: socket.id,
				userId: socket.data?.userId,
			});
		});
	});

	// Handle server errors
	io.on("error", (error: Error) => {
		logger.error("[SOCKET_SERVER_ERROR]", {
			error: error.message,
		});
	});

	logger.info("[SOCKET_INITIALIZED]", {
		useRedisAdapter: !!redisAdapter,
		corsOrigins: process.env.ALLOWED_ORIGINS,
	});

	// Setup cleanup on process exit
	process.on("exit", async () => {
		if (pubClient) {
			await pubClient.quit();
		}
		if (subClient) {
			await subClient.quit();
		}
		io.close();
	});
}

/**
 * Emit event to user
 */
export function emitToUser<EventName extends keyof ServerToClientEvents>(
	userId: string,
	event: EventName,
	data: Parameters<ServerToClientEvents[EventName]>[0],
) {
	getIO().to(`user:${userId}`).emit(event, data);
}

/**
 * Emit event to group
 */
export function emitToGroup<EventName extends keyof ServerToClientEvents>(
	groupId: string,
	event: EventName,
	data: Parameters<ServerToClientEvents[EventName]>[0],
) {
	getIO().to(`group:${groupId}`).emit(event, data);
}

/**
 * Emit event to course
 */
export function emitToCourse<EventName extends keyof ServerToClientEvents>(
	courseId: string,
	event: EventName,
	data: Parameters<ServerToClientEvents[EventName]>[0],
) {
	getIO().to(`course:${courseId}`).emit(event, data);
}
