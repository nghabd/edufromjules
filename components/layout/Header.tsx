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
	Bell,
	MessageCircle,
	ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardPathByRole } from "@/lib/routes";
import { AppLogo } from "@/components/layout/AppLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MessagingDialog } from "@/components/layout/MessagingDialog";
import { AccountProfileDialog } from "@/components/layout/AccountProfileDialog";
import { useState, useRef, useEffect } from "react";

function UserMenu({
	user,
	dashboardPath,
	pathname,
	handleLogout,
}: {
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
		role?: string | null;
		image?: string | null;
	};
	dashboardPath: string;
	pathname: string;
	handleLogout: () => Promise<void>;
}) {
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const userMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
				setUserMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const isDashboardRoute = pathname === dashboardPath;

	return (
		<>
<ThemeToggle />
							<NotificationBell />
							<MessagingDialog currentUserId={user.id} />
							<div className="relative" ref={userMenuRef}>
								<div className="flex items-center gap-3">
									<AccountProfileDialog user={user} />
									<div
										className="hidden lg:flex items-center gap-2 cursor-pointer"
										onClick={() => setUserMenuOpen(!userMenuOpen)}
									>
										<div className="text-left">
											<p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
												{user.name ?? "User"}
											</p>
											<p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
												{(user.role ?? "user").toLowerCase()}
											</p>
										</div>
										<ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" style={{ transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
									</div>
								</div>

								{userMenuOpen && (
					<div className="absolute right-0 mt-2 w-56 origin-top-right animate-in fade-in-0 zoom-in-95 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-50">
						<div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
							<p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
								{user.name ?? "User"}
							</p>
							<p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
								{(user.role ?? "user").toLowerCase()}
							</p>
						</div>
						<div className="border-t border-slate-200 dark:border-slate-700 p-2 space-y-1">
							<Button
								asChild
								variant={pathname === dashboardPath ? "default" : "ghost"}
								size="sm"
								className="w-full justify-start gap-2 rounded-lg"
								onClick={() => setUserMenuOpen(false)}
							>
								<Link href={dashboardPath}>
									<LayoutDashboard className="h-4 w-4" />
									Dashboard
								</Link>
							</Button>
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="w-full justify-start gap-2 rounded-lg"
								onClick={() => setUserMenuOpen(false)}
							>
								<Link href="/pharmacist">
									<Bell className="h-4 w-4" />
									Notifications
								</Link>
							</Button>
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="w-full justify-start gap-2 rounded-lg"
								onClick={() => setUserMenuOpen(false)}
							>
								<Link href="/pharmacist?tab=messages">
									<MessageCircle className="h-4 w-4" />
									Messages
								</Link>
							</Button>
							<div className="border-t border-slate-200 dark:border-slate-700 my-1" />
							<Button
								variant="ghost"
								size="sm"
								className="w-full justify-start gap-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
								onClick={handleLogout}
							>
								<LogOut className="h-4 w-4" />
								Log out
							</Button>
						</div>
					</div>
				)}
			</div>

			<Button
				asChild
				variant={pathname === dashboardPath ? "default" : "ghost"}
				size="sm"
				className="gap-2 rounded-xl"
			>
				<Link href={dashboardPath}>
					<LayoutDashboard className="h-4 w-4" />
					<span className="hidden sm:inline">Dashboard</span>
				</Link>
			</Button>
		</>
	);
}

function AuthButtons({ pathname, handleLogout }: { pathname: string; handleLogout: () => Promise<void> }) {
	return (
		<>
			<ThemeToggle />
			<Button
				asChild
				variant={pathname === "/login" ? "default" : "ghost"}
				size="sm"
				className="gap-2 rounded-xl"
			>
				<Link href="/login">
					<LogIn className="h-4 w-4" />
					<span className="hidden sm:inline">Sign in</span>
				</Link>
			</Button>
			<Button
				asChild
				size="sm"
				className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
			>
				<Link href="/register">
					<UserPlus className="h-4 w-4" />
					<span className="hidden sm:inline">Register</span>
				</Link>
			</Button>
		</>
	);
}

export const Header = () => {
	const { data: session, status } = useSession();
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const userMenuRef = useRef<HTMLDivElement>(null);
	const dashboardPath = session?.user?.role
		? (dashboardPathByRole[session.user.role] ?? "/pharmacist")
		: "/pharmacist";

	const handleLogout = async () => {
		await signOut({ callbackUrl: "/login" });
	};

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
				setUserMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const isDashboardRoute = pathname === dashboardPath;

	return (
		<header className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-sm transition-all duration-300">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<Link
					href="/"
					className="flex items-center gap-2.5 font-bold text-lg hover:opacity-80 transition-opacity"
					aria-label="edustation home"
				>
					<AppLogo className="h-9 w-9" />
					<span className="hidden sm:inline bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
						edustation
					</span>
				</Link>

				<nav className="hidden md:flex items-center gap-2">
					{status === "loading" ? (
						<div className="h-9 w-32 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
					) : session?.user ? (
						<UserMenu
							user={session.user}
							dashboardPath={dashboardPath}
							pathname={pathname}
							handleLogout={handleLogout}
						/>
					) : (
						<AuthButtons pathname={pathname} handleLogout={handleLogout} />
					)}
				</nav>

				<div className="md:hidden flex items-center gap-2">
					<ThemeToggle />
					<Button
						variant="ghost"
						size="sm"
						className="rounded-xl"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						aria-expanded={mobileMenuOpen}
						aria-controls="mobile-menu"
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
					>
						{mobileMenuOpen ? (
							<X className="h-5 w-5" />
						) : (
							<Menu className="h-5 w-5" />
						)}
					</Button>
				</div>
			</div>

			{mobileMenuOpen && (
				<div
					id="mobile-menu"
					className="md:hidden animate-in slide-in-from-top-2 duration-200 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl"
				>
					<div className="px-4 py-4 space-y-3">
						{status === "loading" ? (
							<div className="h-9 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
						) : session?.user ? (
							<>
								<div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700">
									<div className="flex items-center gap-3">
										<AccountProfileDialog user={session.user} />
										<div>
											<p className="text-sm font-semibold text-slate-900 dark:text-white">
												{session.user.name ?? "User"}
											</p>
											<p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
												{(session.user.role ?? "user").toLowerCase()}
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
									variant={isDashboardRoute ? "default" : "ghost"}
									className="w-full justify-start gap-3 rounded-xl"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href={dashboardPath}>
										<LayoutDashboard className="h-5 w-5" />
										Dashboard
									</Link>
								</Button>
								<Button
									asChild
									variant="ghost"
									className="w-full justify-start gap-3 rounded-xl"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href="/pharmacist">
										<Bell className="h-5 w-5" />
										Notifications
									</Link>
								</Button>
								<Button
									asChild
									variant="ghost"
									className="w-full justify-start gap-3 rounded-xl"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href="/pharmacist?tab=messages">
										<MessageCircle className="h-5 w-5" />
										Messages
									</Link>
								</Button>
								<Button
									variant="ghost"
									className="w-full justify-start gap-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
									onClick={() => {
										setMobileMenuOpen(false);
										handleLogout();
									}}
								>
									<LogOut className="h-5 w-5" />
									Log out
								</Button>
							</>
						) : (
							<>
								<Button
									asChild
									variant="ghost"
									className="w-full justify-start gap-3 rounded-xl"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href="/login">
										<LogIn className="h-5 w-5" />
										Sign in
									</Link>
								</Button>
								<Button
									asChild
									className="w-full justify-start gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
									onClick={() => setMobileMenuOpen(false)}
								>
									<Link href="/register">
										<UserPlus className="h-5 w-5" />
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