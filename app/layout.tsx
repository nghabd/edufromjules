import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: {
		default: "edustation",
		template: "%s | edustation",
	},
	description: "Secure pharmacy training for a small team with courses, quizzes, and role-based access.",
	applicationName: "edustation",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const nonce = (await headers()).get("x-nonce") ?? undefined;

	return (
		<html lang="en" suppressHydrationWarning nonce={nonce}>
			<body className={inter.className} nonce={nonce}>
				<Providers>
					<div className="flex min-h-screen flex-col bg-background text-foreground">
						<Header />
						<main className="flex-1">{children}</main>
						<Footer />
					</div>
				</Providers>
			</body>
		</html>
	);
}
