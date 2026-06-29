"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle,
	Loader2,
	Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResetPasswordFormProps = {
	token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const hasUppercase = /[A-Z]/.test(password);
	const hasLowercase = /[a-z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	const isPasswordValid =
		password.length >= 8 && hasUppercase && hasLowercase && hasNumber;
	const passwordsMatch = password === confirmPassword;
	const isFormValid =
		Boolean(token) &&
		isPasswordValid &&
		confirmPassword.length > 0 &&
		passwordsMatch &&
		!loading &&
		!success;

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");

		if (!token) {
			setError("Reset link is invalid or expired.");
			return;
		}

		if (!passwordsMatch) {
			setError("Passwords do not match.");
			return;
		}

		setLoading(true);

		try {
			const response = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});

			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				const message =
					payload.message ?? "Password could not be reset. Please try again.";
				setError(message);
				toast.error(message);
				return;
			}

			setSuccess(true);
			setPassword("");
			setConfirmPassword("");
			toast.success("Password reset successfully.");
		} catch {
			const message = "An unexpected error occurred. Please try again.";
			setError(message);
			toast.error(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-4">
			<Card className="w-full max-w-md shadow-lg border border-slate-200 dark:border-slate-700">
				<div className="p-8">
					<div className="mb-8 text-center">
						<div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-4">
							<Lock className="h-6 w-6 text-white" />
						</div>
						<h1 className="text-2xl font-bold text-slate-900 dark:text-white">
							Create new password
						</h1>
						<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
							Choose a strong password for your edustation account.
						</p>
					</div>

					{(!token || error) && (
						<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
							<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm font-medium text-red-900 dark:text-red-200">
								{error || "Reset link is invalid or expired."}
							</p>
						</div>
					)}

					{success && (
						<div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex gap-3">
							<CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm font-medium text-green-900 dark:text-green-200">
								Password reset successfully. You can now sign in.
							</p>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
								New Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-600" />
								<Input
									required
									type="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="Enter a new password"
									className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
									disabled={loading || success || !token}
								/>
							</div>
							{password && !isPasswordValid && (
								<ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
									<li className={password.length >= 8 ? "text-green-600" : ""}>
										At least 8 characters
									</li>
									<li className={hasUppercase && hasLowercase ? "text-green-600" : ""}>
										Uppercase and lowercase letters
									</li>
									<li className={hasNumber ? "text-green-600" : ""}>
										At least one number
									</li>
								</ul>
							)}
						</div>

						<div>
							<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
								Confirm Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-600" />
								<Input
									required
									type="password"
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									placeholder="Confirm your new password"
									className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
									disabled={loading || success || !token}
								/>
							</div>
							{confirmPassword && !passwordsMatch && (
								<p className="mt-1 text-xs text-red-600 dark:text-red-400">
									Passwords do not match
								</p>
							)}
						</div>

						<Button
							type="submit"
							disabled={!isFormValid}
							className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
						>
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Resetting...
								</>
							) : (
								"Reset password"
							)}
						</Button>
					</form>

					<Button asChild variant="link" className="mt-6 w-full text-blue-600">
						<Link href="/login">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to sign in
						</Link>
					</Button>
				</div>
			</Card>
		</div>
	);
}
