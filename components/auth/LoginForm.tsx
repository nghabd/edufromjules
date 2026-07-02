"use client";

import { FormEvent, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { Loader2, AlertCircle, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuthRedirect } from "@/components/auth/useAuthRedirect";

export const LoginForm = () => {
	useAuthRedirect();
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


	// Input validation
	const isEmailValid = email.includes("@") && email.includes(".");
	const isPasswordValid = password.length >= 8;
	const isFormValid = isEmailValid && isPasswordValid && !loading;

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			// Note: redirect: false prevents NextAuth from taking over navigation
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

				// Save preference if remember me is checked
				if (rememberMe) {
					localStorage.setItem("savedEmail", email);
				} else {
					localStorage.removeItem("savedEmail");
				}

				// Do NOT manually redirect here.
				// The useEffect above will catch the updated session status and smoothly redirect.
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
					{/* Header */}
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

					{/* Error Alert */}
					{error && (
						<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
							<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
							<div>
								<p className="text-sm font-medium text-red-900 dark:text-red-200">
									{error}
								</p>
							</div>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Email Input */}
						<div>
							<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
								Email Address
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-600" />
								<Input
									required
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="your@email.com"
									className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
									disabled={loading}
								/>
							</div>
							{email && !isEmailValid && (
								<p className="mt-1 text-xs text-red-600 dark:text-red-400">
									Please enter a valid email address
								</p>
							)}
						</div>

						{/* Password Input */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
									Password
								</label>
								<a
									href="/forgot-password"
									className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
								>
									Forgot?
								</a>
							</div>
							<div className="relative">
								<Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-600" />
								<Input
									required
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••"
									className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
									disabled={loading}
								/>
							</div>
							{password && !isPasswordValid && (
								<p className="mt-1 text-xs text-red-600 dark:text-red-400">
									Password must be at least 8 characters
								</p>
							)}
						</div>

						{/* Remember Me */}
						<div className="flex items-center">
							<input
								type="checkbox"
								id="remember"
								checked={rememberMe}
								onChange={(e) => setRememberMe(e.target.checked)}
								className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
								disabled={loading}
							/>
							<label
								htmlFor="remember"
								className="ml-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
							>
								Remember this email
							</label>
						</div>

						{/* Sign In Button */}
						<Button
							type="submit"
							disabled={!isFormValid}
							className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
						>
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Signing in...
								</>
							) : (
								"Sign in"
							)}
						</Button>

						{/* Divider */}
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

						{/* Google Sign In */}
						<Button
							type="button"
							variant="outline"
							className="w-full h-11 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
							onClick={() => signIn("google", { callbackUrl: "/pharmacist" })}
							disabled={loading}
						>
							<svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
								<path
									fill="currentColor"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="currentColor"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="currentColor"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="currentColor"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
							Sign in with Google
						</Button>

						{/* Sign Up Link */}
						<p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
							Don&apos;t have an account?{" "}
							<a
								href="/register"
								className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
							>
								Create one
							</a>
						</p>
					</form>
				</div>
			</Card>
		</div>
	);
};
