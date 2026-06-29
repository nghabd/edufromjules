import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Clock3, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type HeroSectionProps = {
	dashboardPath: string;
	isAuthenticated: boolean;
	userName: string | null;
};

const highlights = [
	{
		icon: ShieldCheck,
		title: "Private by default",
		text: "Designed for a small internal team with role-based access.",
	},
	{
		icon: Clock3,
		title: "Fast to use",
		text: "Lean pages, fewer moving parts, and quick navigation.",
	},
	{
		icon: LayoutDashboard,
		title: "Clear workflow",
		text: "Courses, progress, and approvals stay in one place.",
	},
];

export function HeroSection({
	dashboardPath,
	isAuthenticated,
	userName,
}: HeroSectionProps) {
	return (
		<section className="relative overflow-hidden">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_45%),linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))] dark:bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.24),transparent_45%),linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,1))]" />
			<div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center px-4 py-16 sm:px-6 lg:px-8">
				<div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
					<div className="space-y-8">
						<div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
							<Image
								src="/brand/edustation-gemini-logo.gif"
								alt="edustation logo"
								width={32}
								height={32}
								unoptimized
								className="h-8 w-8 rounded-xl object-contain"
							/>
							<span>edustation for a small training team</span>
						</div>

						<div className="space-y-5">
							<p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
								Focused learning
							</p>
							<h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
								Simple training tools for a pharmacy team of around 100 users.
							</h1>
							<p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
								Keep the product straightforward: secure sign-in, course
								materials, quizzes, progress tracking, and role-aware access
								without the extra marketing noise.
							</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								asChild
								size="lg"
								className="gap-2 bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
							>
								<Link href={isAuthenticated ? dashboardPath : "/login"}>
									{isAuthenticated ? "Continue to dashboard" : "Sign in"}
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
							{!isAuthenticated && (
								<Button
									asChild
									variant="outline"
									size="lg"
									className="border-slate-300 bg-white/70 text-slate-900 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:hover:bg-slate-900"
								>
									<Link href="/register">Create account</Link>
								</Button>
							)}
						</div>

						<div className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-400">
							<span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 dark:border-slate-800 dark:bg-slate-950/50">
								Role-based access
							</span>
							<span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 dark:border-slate-800 dark:bg-slate-950/50">
								Vercel-ready
							</span>
							<span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 dark:border-slate-800 dark:bg-slate-950/50">
								Production focused
							</span>
						</div>

						{isAuthenticated && userName ? (
							<p className="text-sm text-slate-500 dark:text-slate-400">
								Signed in as <span className="font-medium">{userName}</span>.
							</p>
						) : (
							<p className="text-sm text-slate-500 dark:text-slate-400">
								New here? Start with sign in or create an account.
							</p>
						)}
					</div>

					<Card className="border-slate-200/80 bg-white/85 shadow-2xl shadow-blue-950/5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
						<CardContent className="space-y-6 p-6 sm:p-8">
							<div className="space-y-2">
								<p className="text-sm font-medium text-slate-500 dark:text-slate-400">
									What the app covers
								</p>
								<h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
									One clean place for the essentials
								</h2>
							</div>

							<div className="space-y-4">
								{highlights.map(({ icon: Icon, title, text }) => (
									<div
										key={title}
										className="flex gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
									>
										<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
											<Icon className="h-5 w-5" />
										</div>
										<div>
											<h3 className="font-medium text-slate-950 dark:text-white">
												{title}
											</h3>
											<p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
												{text}
											</p>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	);
}
