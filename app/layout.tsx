import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getNonce } from "@/lib/nonce";

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
	const nonce = await getNonce();

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{nonce && <meta property="csp-nonce" content={nonce} />}
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
