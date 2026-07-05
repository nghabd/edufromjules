"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

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

	return (
		<SessionProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<QueryClientProvider client={queryClient}>
					{children}
					<Toaster position="top-right" />
				</QueryClientProvider>
			</ThemeProvider>
		</SessionProvider>
	);
}
