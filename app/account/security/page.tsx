import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PasswordChangeForm } from "@/components/account/PasswordChangeForm";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

export default async function AccountSecurityPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user) {
		redirect("/login");
	}

	return (
		<div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-2xl items-center px-4 py-10">
			<Card className="w-full border-slate-200 shadow-sm dark:border-slate-800">
				<div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
					<h1 className="text-xl font-bold text-slate-900 dark:text-white">
						Account security
					</h1>
					<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
						Change your password by confirming your current password.
					</p>
				</div>
				<div className="p-6">
					<PasswordChangeForm />
				</div>
			</Card>
		</div>
	);
}
