"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import axios from "axios";
import { Toaster } from "react-hot-toast";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function installAuthInterceptor() {
	const interceptor = axios.interceptors.response.use(
		(response) => response,
		(error) => {
			if (!axios.isAxiosError(error) || error.response?.status !== 401) {
				return Promise.reject(error);
			}

			const method = String(error.config?.method || "get").toLowerCase();
			if (method === "get" && typeof window !== "undefined") {
				const path = window.location.pathname;
				const isAuthPage = AUTH_PATHS.some(
					(authPath) => path === authPath || path.startsWith(`${authPath}/`),
				);
				if (!isAuthPage) {
					window.location.assign("/login");
				}
			}

			return Promise.reject(error);
		},
	);

	return () => {
		axios.interceptors.response.eject(interceptor);
	};
}

export function Providers({
	children,
	nonce,
}: {
	children: React.ReactNode;
	nonce?: string;
}) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						gcTime: 5 * 60_000,
						refetchOnWindowFocus: true,
						retry: 1,
					},
					mutations: {
						retry: false,
					},
				},
			}),
	);

	useEffect(() => installAuthInterceptor(), []);

	return (
		<SessionProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
				nonce={nonce}
			>
				<QueryClientProvider client={queryClient}>
					{children}
					<Toaster position="top-right" />
				</QueryClientProvider>
			</ThemeProvider>
		</SessionProvider>
	);
}
