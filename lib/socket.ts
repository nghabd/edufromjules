import { Server as NetServer } from "http";
import { Socket as NetSocket } from "net";
import { NextApiResponse } from "next";
import { Server as SocketIOServer, Socket as IOSocket } from "socket.io";
import { verify, JwtPayload } from "jsonwebtoken";
import { prisma } from "./prisma";
import { logger } from "./logger";

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
	progress: (data: { materialId: string; progress: number; userId: string }) => void;
	notification: (data: { title: string; message: string; type: string }) => void;
	quiz: (data: { quizId: string; score: number; passed: boolean }) => void;
	assignment: (data: { courseId: string; status: string }) => void;
	error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
	join: (userId: string) => void;
	joinGroup: (groupId: string) => void;
	progressUpdate: (data: { materialId: string; progress: number }) => void;
}

let io: SocketIOServer;

export function getIO() {
	if (!io) {
		throw new Error("Socket.io not initialized");
	}
	return io;
}

/**
 * Authenticate socket connection using JWT token
 */
type AuthenticatedSocket = IOSocket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

async function authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void) {
	try {
		const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			logger.warn("[SOCKET_AUTH] No token provided", { socketId: socket.id });
			return next(new Error("Authentication error: No token provided"));
		}

		// Use NEXTAUTH_SECRET for JWT verification
		const secret = process.env.NEXTAUTH_SECRET;
		if (!secret) {
			logger.error("[SOCKET_AUTH] NEXTAUTH_SECRET not configured");
			return next(new Error("Server configuration error"));
		}

		let decoded: JwtPayload & { id?: string; role?: string; type?: string };
		try {
			decoded = verify(token, secret) as JwtPayload & { id?: string; role?: string };
		} catch (error) {
			logger.warn("[SOCKET_AUTH] Invalid token", { socketId: socket.id, error: (error as Error).message });
			return next(new Error("Authentication error: Invalid token"));
		}

		if (!decoded?.id) {
			logger.warn("[SOCKET_AUTH] Invalid token payload", { socketId: socket.id });
			return next(new Error("Authentication error: Invalid token"));
		}
		if (decoded.type !== "socket") {
			logger.warn("[SOCKET_AUTH] Invalid token type", { socketId: socket.id });
			return next(new Error("Authentication error: Invalid token"));
		}

		// Verify user exists in database
		const user = await prisma.user.findUnique({
			where: { id: decoded.id },
			select: { id: true, role: true, groupId: true, email: true },
		});

		if (!user) {
			logger.warn("[SOCKET_AUTH] User not found", { userId: decoded.id, socketId: socket.id });
			return next(new Error("Authentication error: User not found"));
		}

		// Set socket data
		socket.data.userId = user.id;
		socket.data.role = user.role;
		socket.data.groupId = user.groupId ?? undefined;
		socket.data.userEmail = user.email;

		logger.debug("[SOCKET_AUTH] Socket authenticated", {
			socketId: socket.id,
			userId: user.id,
			role: user.role,
		});

		next();
	} catch (error) {
		logger.error("[SOCKET_AUTH] Authentication error", { error: (error as Error).message });
		next(new Error("Authentication error"));
	}
}

/**
 * Initialize Socket.io server
 */
export function initSocket(server: NetServer) {
	if (!io) {
		const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
		const allowedOrigins = (process.env.ALLOWED_ORIGINS || origin)
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);

		io = new SocketIOServer(server, {
			cors: {
				origin: allowedOrigins,
				methods: ["GET", "POST"],
				credentials: true,
				allowedHeaders: ["Authorization"],
			},
			// Performance tuning
			pingTimeout: 60000,
			pingInterval: 25000,
			transports: ["websocket", "polling"],
			// Reduce memory usage
			maxHttpBufferSize: 1e6, // 1MB
		});

		// Apply authentication middleware
		io.use(authenticateSocket);

		/**
		 * Handle new socket connections
		 */
		io.on("connection", (socket: AuthenticatedSocket) => {
			const userId = socket.data.userId;
			const role = socket.data.role;
			const groupId = socket.data.groupId;

			logger.info("[SOCKET_CONNECTED]", {
				socketId: socket.id,
				userId,
				role,
				connectedClients: io.engine.clientsCount,
			});

			// Join user to their personal room
			socket.join(`user:${userId}`);

			// Join supervisor to group room
			if (role === "SUPERVISOR" && groupId) {
				socket.join(`group:${groupId}`);
				logger.debug("[SOCKET_GROUP_JOINED]", { socketId: socket.id, groupId });
			}

			/**
			 * Handle manual join requests
			 */
			socket.on("join", (requestedUserId: string) => {
				if (socket.data.userId === requestedUserId) {
					socket.join(`user:${requestedUserId}`);
					logger.debug("[SOCKET_MANUAL_JOIN]", { socketId: socket.id, userId: requestedUserId });
				}
			});

			/**
			 * Handle group join requests
			 */
			socket.on("joinGroup", (requestedGroupId: string) => {
				// Only allow if user is supervisor of the group or is admin
				if ((socket.data.groupId === requestedGroupId || socket.data.role === "ADMIN") && requestedGroupId) {
					socket.join(`group:${requestedGroupId}`);
					logger.debug("[SOCKET_GROUP_MANUAL_JOIN]", { socketId: socket.id, groupId: requestedGroupId });
				}
			});

			/**
			 * Handle progress updates with validation
			 */
			socket.on("progressUpdate", async (data: { materialId: string; progress: number }) => {
				try {
					// Validate input
					if (!data?.materialId || typeof data.progress !== "number") {
						socket.emit("error", { message: "Invalid data format" });
						return;
					}

					// Validate progress value
					if (data.progress < 0 || data.progress > 100) {
						socket.emit("error", { message: "Invalid progress value" });
						logger.warn("[SOCKET_INVALID_PROGRESS]", {
							socketId: socket.id,
							userId,
							progress: data.progress,
						});
						return;
					}

					// Emit to user's group (supervisor can see progress)
					if (groupId) {
						io.to(`group:${groupId}`).emit("progress", {
							materialId: data.materialId,
							progress: data.progress,
							userId: userId,
						});
					}

					// Also emit to user's own room for real-time updates
					io.to(`user:${userId}`).emit("progress", {
						materialId: data.materialId,
						progress: data.progress,
						userId: userId,
					});

					logger.debug("[SOCKET_PROGRESS_UPDATE]", {
						socketId: socket.id,
						userId,
						materialId: data.materialId,
						progress: data.progress,
					});
				} catch (error) {
					logger.error("[SOCKET_PROGRESS_ERROR]", {
						socketId: socket.id,
						error: (error as Error).message,
					});
					socket.emit("error", { message: "Failed to update progress" });
				}
			});

			/**
			 * Handle disconnection
			 */
			socket.on("disconnect", () => {
				logger.info("[SOCKET_DISCONNECTED]", {
					socketId: socket.id,
					userId,
					connectedClients: io.engine.clientsCount,
				});
			});

			/**
			 * Handle errors
			 */
			socket.on("error", (error: Error) => {
				logger.error("[SOCKET_ERROR]", {
					socketId: socket.id,
					userId,
					error: error.message,
				});
			});
		});

		logger.info("[SOCKET_INITIALIZED]", { corsOrigin: allowedOrigins });
	}
}

/**
 * Emit notification to specific user
 */
export function emitNotification(
	userId: string,
	data: { title: string; message: string; type: string }
) {
	if (io) {
		io.to(`user:${userId}`).emit("notification", data);
		logger.debug("[EMIT_NOTIFICATION]", { userId, title: data.title });
	}
}

/**
 * Emit quiz result to specific user
 */
export function emitQuizResult(
	userId: string,
	data: { quizId: string; score: number; passed: boolean }
) {
	if (io) {
		io.to(`user:${userId}`).emit("quiz", data);
		logger.debug("[EMIT_QUIZ]", { userId, quizId: data.quizId, score: data.score });
	}
}

/**
 * Broadcast to group
 */
export function broadcastToGroup(
	groupId: string,
	event: string,
	data: unknown
) {
	if (io) {
		io.to(`group:${groupId}`).emit(event, data);
		logger.debug("[BROADCAST_GROUP]", { groupId, event });
	}
}
