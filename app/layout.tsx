import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta
					httpEquiv="Content-Security-Policy"
					content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https:; frame-ancestors 'self';"
				/>
			</head>
			<body className={inter.className}>
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
