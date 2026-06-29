"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle, KeyRound, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordChangeForm() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const hasUppercase = /[A-Z]/.test(newPassword);
	const hasLowercase = /[a-z]/.test(newPassword);
	const hasNumber = /[0-9]/.test(newPassword);
	const isPasswordValid =
		newPassword.length >= 8 && hasUppercase && hasLowercase && hasNumber;
	const passwordsMatch = newPassword === confirmPassword;
	const isFormValid =
		currentPassword.length > 0 &&
		isPasswordValid &&
		confirmPassword.length > 0 &&
		passwordsMatch &&
		!loading;

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setSuccess(false);

		if (!passwordsMatch) {
			setError("Passwords do not match.");
			return;
		}

		setLoading(true);

		try {
			const response = await fetch("/api/account/password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currentPassword, newPassword }),
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				const message = payload.message || "Password could not be updated.";
				setError(message);
				toast.error(message);
				return;
			}

			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSuccess(true);
			toast.success("Password updated.");
		} catch {
			const message = "An unexpected error occurred. Please try again.";
			setError(message);
			toast.error(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
					{error}
				</div>
			)}

			{success && (
				<div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
					<CheckCircle className="h-4 w-4" />
					Password updated successfully.
				</div>
			)}

			<div>
				<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
					Current password
				</label>
				<div className="relative">
					<Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
					<Input
						required
						type="password"
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
						className="h-11 pl-10"
						autoComplete="current-password"
					/>
				</div>
			</div>

			<div>
				<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
					New password
				</label>
				<div className="relative">
					<KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
					<Input
						required
						type="password"
						value={newPassword}
						onChange={(event) => setNewPassword(event.target.value)}
						className="h-11 pl-10"
						autoComplete="new-password"
					/>
				</div>
				{newPassword && !isPasswordValid && (
					<ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
						<li className={newPassword.length >= 8 ? "text-emerald-600" : ""}>
							At least 8 characters
						</li>
						<li
							className={
								hasUppercase && hasLowercase ? "text-emerald-600" : ""
							}
						>
							Uppercase and lowercase letters
						</li>
						<li className={hasNumber ? "text-emerald-600" : ""}>
							At least one number
						</li>
					</ul>
				)}
			</div>

			<div>
				<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
					Confirm new password
				</label>
				<div className="relative">
					<KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
					<Input
						required
						type="password"
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
						className="h-11 pl-10"
						autoComplete="new-password"
					/>
				</div>
				{confirmPassword && !passwordsMatch && (
					<p className="mt-1 text-xs text-red-600 dark:text-red-400">
						Passwords do not match.
					</p>
				)}
			</div>

			<Button type="submit" disabled={!isFormValid} className="h-11 w-full">
				{loading ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Updating...
					</>
				) : (
					"Update password"
				)}
			</Button>
		</form>
	);
}
