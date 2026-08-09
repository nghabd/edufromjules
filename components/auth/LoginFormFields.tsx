"use client";

import { AlertCircle, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginFormFieldsProps = {
	email: string;
	password: string;
	rememberMe: boolean;
	error: string;
	loading: boolean;
	onEmailChange: (value: string) => void;
	onPasswordChange: (value: string) => void;
	onRememberMeChange: (checked: boolean) => void;
	onSubmit: (event: React.FormEvent) => void;
};

export function LoginFormFields({
	email,
	password,
	rememberMe,
	error,
	loading,
	onEmailChange,
	onPasswordChange,
	onRememberMeChange,
	onSubmit,
}: LoginFormFieldsProps) {
	const isEmailValid = email.includes("@") && email.includes(".");
	const isPasswordValid = password.length >= 8;
	const isFormValid = isEmailValid && isPasswordValid && !loading;

	return (
		<>
			{error && (
				<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
					<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
					<p className="text-sm font-medium text-red-900 dark:text-red-200">
						{error}
					</p>
				</div>
			)}

			<form onSubmit={onSubmit} className="space-y-4">
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
							onChange={(e) => onEmailChange(e.target.value)}
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
							onChange={(e) => onPasswordChange(e.target.value)}
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

				<div className="flex items-center">
					<input
						type="checkbox"
						id="remember"
						checked={rememberMe}
						onChange={(e) => onRememberMeChange(e.target.checked)}
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

				<Button
					type="submit"
					disabled={!isFormValid}
					className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
				>
					{loading ? "Signing in..." : "Sign in"}
				</Button>
			</form>
		</>
	);
}
