"use client";

import { FormEvent, useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getDashboardPath } from "@/lib/auth-routing";
import { LoginFormFields } from "@/components/auth/LoginFormFields";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export const LoginForm = () => {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [rememberMe, setRememberMe] = useState(false);

	useEffect(() => {
		const savedEmail = localStorage.getItem("savedEmail");
		if (savedEmail) {
			const frame = window.requestAnimationFrame(() => {
				setEmail(savedEmail);
				setRememberMe(true);
			});
			return () => window.cancelAnimationFrame(frame);
		}
	}, []);

	useEffect(() => {
		if (status === "authenticated" && session?.user?.role) {
			router.replace(getDashboardPath(session.user.role));
		}
	}, [status, session, router]);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await signIn("credentials", {
				email,
				password,
				redirect: false,
			});

			if (result?.error) {
				const message =
					result.error === "CredentialsSignin"
						? "Invalid email or password. Please try again."
						: "Authentication failed. Please try again.";
				setError(message);
				toast.error(message);
				setLoading(false);
				return;
			}

			if (result?.ok) {
				toast.success("Logged in successfully!");
				if (rememberMe) {
					localStorage.setItem("savedEmail", email);
				} else {
					localStorage.removeItem("savedEmail");
				}
			}
		} catch {
			const message = "An unexpected error occurred. Please try again.";
			setError(message);
			toast.error(message);
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-4">
			<Card className="w-full max-w-md shadow-lg border border-slate-200 dark:border-slate-700">
				<div className="p-8">
					<div className="mb-8 text-center">
						<div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-4">
							<span className="text-white font-bold text-xl">E</span>
						</div>
						<h1 className="text-2xl font-bold text-slate-900 dark:text-white">
							Welcome back
						</h1>
						<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
							Sign in to access your courses and learning dashboard
						</p>
					</div>

					<LoginFormFields
						email={email}
						password={password}
						rememberMe={rememberMe}
						error={error}
						loading={loading}
						onEmailChange={setEmail}
						onPasswordChange={setPassword}
						onRememberMeChange={setRememberMe}
						onSubmit={handleSubmit}
					/>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-slate-200 dark:border-slate-700" />
						</div>
						<div className="relative flex justify-center text-xs">
							<span className="px-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400">
								or continue with
							</span>
						</div>
					</div>

					<GoogleSignInButton disabled={loading} />

					<p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
						Don&apos;t have an account?{" "}
						<a
							href="/register"
							className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
						>
							Create one
						</a>
					</p>

					{loading && (
						<div className="mt-4 flex items-center justify-center text-sm text-slate-500">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Redirecting to your dashboard...
						</div>
					)}
				</div>
			</Card>
		</div>
	);
};
