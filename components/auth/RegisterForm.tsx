"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
	Loader2,
	AlertCircle,
	User,
	Mail,
	Lock,
	CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuthRedirect } from "@/components/auth/useAuthRedirect";

export const RegisterForm = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [passwordStrength, setPasswordStrength] = useState(0);
	const router = useRouter();
	useAuthRedirect();

	// Password strength indicator
	const calculatePasswordStrength = (pwd: string) => {
		let strength = 0;
		if (pwd.length >= 8) strength++;
		if (pwd.length >= 12) strength++;
		if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
		if (/[0-9]/.test(pwd)) strength++;
		if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
		return strength;
	};

	const handlePasswordChange = (pwd: string) => {
		setPassword(pwd);
		setPasswordStrength(calculatePasswordStrength(pwd));
	};

	// Input validation
	const isNameValid = name.trim().length >= 2;
	const isEmailValid = email.includes("@") && email.includes(".");
	const isPasswordValid = password.length >= 8;
	const isFormValid =
		isNameValid && isEmailValid && isPasswordValid && !loading;

	const getPasswordStrengthLabel = () => {
		const labels = [
			"Very Weak",
			"Weak",
			"Fair",
			"Good",
			"Strong",
			"Very Strong",
		];
		return labels[passwordStrength] || "Very Weak";
	};

	const getPasswordStrengthColor = () => {
		const colors = [
			"bg-red-500",
			"bg-orange-500",
			"bg-yellow-500",
			"bg-blue-500",
			"bg-green-500",
			"bg-emerald-500",
		];
		return colors[passwordStrength] || "bg-red-500";
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password, name: name.trim() }),
			});

			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				setLoading(false);
				const message =
					payload.message ?? "Registration failed. Please try again.";
				setError(message);
				toast.error(message);
				return;
			}

			// Try to sign in automatically
			const result = await signIn("credentials", {
				email,
				password,
				redirect: false,
			});

			if (result?.ok) {
				toast.success("Account created successfully!");
				await getSession();
				router.replace("/pharmacist");
				router.refresh();
			} else {
				toast.success("Account created! Please sign in.");
				router.replace("/login");
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
							Join edustation
						</h1>
						<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
							Create your account to start learning today
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
						{/* Name Input */}
						<div>
							<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
								Full Name
							</label>
							<div className="relative">
								<User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-600" />
								<Input
									required
									type="text"
									placeholder="John Doe"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
									disabled={loading}
								/>
							</div>
							{name && !isNameValid && (
								<p className="mt-1 text-xs text-red-600 dark:text-red-400">
									Name must be at least 2 characters
								</p>
							)}
						</div>

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
									placeholder="your@email.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
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
							<label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
								Password
							</label>
							<div className="relative">
								<Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-600" />
								<Input
									required
									minLength={8}
									type="password"
									placeholder="••••••••"
									value={password}
									onChange={(e) => handlePasswordChange(e.target.value)}
									className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
									disabled={loading}
								/>
							</div>

							{/* Password Strength Indicator */}
							{password && (
								<div className="mt-3 space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
											Password strength
										</span>
										<span
											className={`text-xs font-semibold ${passwordStrength >= 3 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}
										>
											{getPasswordStrengthLabel()}
										</span>
									</div>
									<div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
										<div
											className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
											style={{ width: `${(passwordStrength / 5) * 100}%` }}
										/>
									</div>
									<ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
										<li className="flex items-center gap-2">
											<CheckCircle
												className={`w-3 h-3 ${password.length >= 8 ? "text-green-600 dark:text-green-400" : "text-slate-400 dark:text-slate-600"}`}
											/>
											At least 8 characters
										</li>
										<li className="flex items-center gap-2">
											<CheckCircle
												className={`w-3 h-3 ${/[A-Z]/.test(password) && /[a-z]/.test(password) ? "text-green-600 dark:text-green-400" : "text-slate-400 dark:text-slate-600"}`}
											/>
											Mixed case letters
										</li>
										<li className="flex items-center gap-2">
											<CheckCircle
												className={`w-3 h-3 ${/[0-9]/.test(password) ? "text-green-600 dark:text-green-400" : "text-slate-400 dark:text-slate-600"}`}
											/>
											At least one number
										</li>
									</ul>
								</div>
							)}
						</div>

						{/* Sign Up Button */}
						<Button
							type="submit"
							disabled={!isFormValid}
							className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 mt-6"
						>
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating account...
								</>
							) : (
								"Create Account"
							)}
						</Button>

						{/* Login Link */}
						<p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
							Already have an account?{" "}
							<a
								href="/login"
								className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
							>
								Sign in
							</a>
						</p>

						{/* Info Note */}
						<div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
							<p className="text-xs text-blue-900 dark:text-blue-200">
								<span className="font-semibold">ℹ️ Note:</span> New accounts
								start as pharmacists and can receive course assignments.
							</p>
						</div>
					</form>
				</div>
			</Card>
		</div>
	);
};
