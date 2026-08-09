import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function UnauthorizedPage() {
	return (
		<div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
			<Card className="w-full max-w-md p-8 text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
					<ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
				</div>
				<h1 className="text-2xl font-bold text-slate-900 dark:text-white">
					Access denied
				</h1>
				<p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
					You don&apos;t have permission to view this page. Sign in with the
					correct account or return to your dashboard.
				</p>
				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button asChild variant="outline">
						<Link href="/login">Sign in</Link>
					</Button>
					<Button asChild>
						<Link href="/">Go home</Link>
					</Button>
				</div>
			</Card>
		</div>
	);
}
