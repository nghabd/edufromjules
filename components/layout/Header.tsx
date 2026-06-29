"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	LogIn,
	LogOut,
	UserPlus,
	Menu,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardPathByRole } from "@/lib/routes";
import { AppLogo } from "@/components/layout/AppLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessagingDialog } from "@/components/layout/MessagingDialog";
import { AccountProfileDialog } from "@/components/layout/AccountProfileDialog";
import { useState } from "react";

export const Header = () => {
	const { data: session, status } = useSession();
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const dashboardPath = session?.user?.role
		? (dashboardPathByRole[session.user.role] ?? "/pharmacist")
		: "/pharmacist";

	// FIX 1: Use native NextAuth callbackUrl to completely wipe session state
	const handleLogout = async () => {
		await signOut({ callbackUrl: "/login" });
	};

	return (
		<header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
				{/* Logo */}
				<Link
					href="/"
					className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
				>
					<AppLogo className="h-10 w-10" />
					<span className="hidden sm:inline text-slate-900 dark:text-white">
						edustation
					</span>
				</Link>

				{/* Desktop Navigation */}
				<nav className="hidden md:flex items-center gap-3">
					{status === "loading" ? (
						<div className="h-9 w-32 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
					) : session?.user ? (
						<>
							<ThemeToggle />
							<NotificationBell />
							<MessagingDialog currentUserId={session.user.id} />
							<div className="hidden lg:block px-3 py-2 text-right border-r border-slate-200 dark:border-slate-700">
								<p className="text-sm font-semibold text-slate-900 dark:text-white">
									{session.user.name ?? "User"}
								</p>
								<p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
									{session.user.role.toLowerCase()}
								</p>
							</div>
							<AccountProfileDialog user={session.user} />
							{/* FIX 2: Added asChild to prevent valid HTML issues */}
							<Button
								asChild
								variant={pathname === dashboardPath ? "default" : "ghost"}
								size="sm"
								className="gap-2"
							>
								<Link href={dashboardPath}>
									<LayoutDashboard className="h-4 w-4" />
									<span className="hidden sm:inline">Dashboard</span>
								</Link>
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
								onClick={handleLogout}
							>
								<LogOut className="h-4 w-4" />
								<span className="hidden sm:inline">Log out</span>
							</Button>
						</>
					) : (
						<>
							<ThemeToggle />
							{/* FIX 2: Added asChild to prevent click-swallowing */}
							<Button
								asChild
								variant={pathname === "/login" ? "default" : "ghost"}
								size="sm"
								className="gap-2"
							>
								<Link href="/login">
									<LogIn className="h-4 w-4" />
									<span className="hidden sm:inline">Sign in</span>
								</Link>
							</Button>
							<Button
								asChild
								size="sm"
								className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
							>
								<Link href="/register">
									<UserPlus className="h-4 w-4" />
									<span className="hidden sm:inline">Register</span>
								</Link>
							</Button>
						</>
					)}
				</nav>

				{/* Mobile Navigation Toggle */}
				<div className="md:hidden flex items-center gap-2">
					<ThemeToggle />
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
					>
						{mobileMenuOpen ? (
							<X className="h-5 w-5" />
						) : (
							<Menu className="h-5 w-5" />
						)}
					</Button>
				</div>
			</div>

			{/* Mobile Menu */}
			{mobileMenuOpen && (
				<div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
					<div className="px-4 py-4 space-y-3">
						{status === "loading" ? (
							<div className="h-9 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
						) : session?.user ? (
							<>
								<div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 mb-3">
									<div className="flex items-center gap-3">
										<AccountProfileDialog user={session.user} />
										<div>
											<p className="text-sm font-semibold text-slate-900 dark:text-white">
												{session.user.name ?? "User"}
											</p>
											<p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
												{session.user.role.toLowerCase()}
											</p>
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2 px-3">
									<NotificationBell />
									<MessagingDialog currentUserId={session.user.id} />
								</div>
								<Button
									asChild
									variant={pathname === dashboardPath ? "default" : "ghost"}
									className="w-full justify-start gap-2"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href={dashboardPath}>
										<LayoutDashboard className="h-4 w-4" />
										Dashboard
									</Link>
								</Button>
								<Button
									variant="ghost"
									className="w-full justify-start gap-2 text-slate-600 dark:text-slate-400"
									onClick={() => {
										setMobileMenuOpen(false);
										handleLogout();
									}}
								>
									<LogOut className="h-4 w-4" />
									Log out
								</Button>
							</>
						) : (
							<>
								<Button
									asChild
									variant="ghost"
									className="w-full justify-start gap-2"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href="/login">
										<LogIn className="h-4 w-4" />
										Sign in
									</Link>
								</Button>
								<Button
									asChild
									className="w-full justify-start gap-2 bg-gradient-to-r from-blue-600 to-indigo-600"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href="/register">
										<UserPlus className="h-4 w-4" />
										Register
									</Link>
								</Button>
							</>
						)}
					</div>
				</div>
			)}
		</header>
	);
};
