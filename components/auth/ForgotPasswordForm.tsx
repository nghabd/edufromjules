"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	const isEmailValid = email.includes("@") && email.includes(".");
	const isFormValid = isEmailValid && !loading;

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);

		try {
			const response = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const payload = await response.json().catch(() => ({}));
			const responseMessage =
				payload.message ??
				"If an account exists for that email, we sent a password reset link.";

			if (!response.ok) {
				setError(responseMessage);
				toast.error(responseMessage);
				return;
			}

			setMessage(responseMessage);
			toast.success("Check your email for the reset link.");
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
							<Mail className="h-6 w-6 text-white" />
						</div>
						<h1 className="text-2xl font-bold text-slate-900 dark:text-white">
							Reset password
						</h1>
						<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
							Enter your email address and we will send a reset link.
						</p>
					</div>

					{error && (
						<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
							<AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm font-medium text-red-900 dark:text-red-200">
								{error}
							</p>
						</div>
					)}

					{message && (
						<div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex gap-3">
							<CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
							<p className="text-sm font-medium text-green-900 dark:text-green-200">
								{message}
							</p>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
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
									onChange={(event) => setEmail(event.target.value)}
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

						<Button
							type="submit"
							disabled={!isFormValid}
							className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
						>
							{loading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Sending...
								</>
							) : (
								"Send reset link"
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
