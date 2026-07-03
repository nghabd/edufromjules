import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { getClientAppOrigin } from "@/lib/client-origin";

export function useSocket(userId?: string, groupId?: string) {
	const socketRef = useRef<Socket | undefined>(undefined);
	const [isConnected, setIsConnected] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const { data: session } = useSession();

	useEffect(() => {
		if (!userId || !session?.user?.id) return;

		let isMounted = true;
		let socketInstance: Socket | undefined;

		const connectSocket = async () => {
			const tokenResponse = await fetch("/api/socket/token", { method: "GET", credentials: "include" });
			if (!tokenResponse.ok) {
				throw new Error("Failed to create socket token");
			}
			const { token } = (await tokenResponse.json()) as { token: string };

			if (!isMounted) return;

			socketInstance = io(getClientAppOrigin(), {
				auth: { token },
				transports: ["websocket", "polling"],
				reconnection: true,
				reconnectionDelay: 1000,
				reconnectionDelayMax: 5000,
				reconnectionAttempts: 5,
			});
			socketRef.current = socketInstance;

			socketInstance.on("connect", () => {
				setIsConnected(true);
				setConnectionError(null);
				socketInstance?.emit("join", userId);
				if (groupId) socketInstance?.emit("joinGroup", groupId);
			});

			socketInstance.on("disconnect", () => {
				setIsConnected(false);
			});

			socketInstance.on("connect_error", (error) => {
				const authError = /auth|invalid token|unauthorized/i.test(error.message);
				if (authError) {
					socketInstance?.disconnect();
				}
				setConnectionError(error.message);
			});
		};

		void connectSocket().catch((error: unknown) => {
			setConnectionError(error instanceof Error ? error.message : "Socket connection failed");
		});

		return () => {
			isMounted = false;
			socketInstance?.removeAllListeners();
			socketInstance?.disconnect();
			socketRef.current = undefined;
		};
	}, [groupId, session?.user?.id, userId]);

	const emitProgress = useCallback((materialId: string, progress: number) => {
		if (socketRef.current?.connected && userId) {
			socketRef.current.emit("progressUpdate", {
				materialId,
				progress,
			});
		}
	}, [userId]);

	const reconnect = useCallback(() => {
		setConnectionError(null);
		socketRef.current?.connect();
	}, []);

	return {
		emitProgress,
		isConnected,
		connectionError: connectionError ?? (userId && !session?.user?.id ? "Authentication required" : null),
		reconnect,
		socketRef,
	};
}
