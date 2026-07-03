import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
	await redirectIfAuthenticated();

	return (
		<div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
			<LoginForm />
		</div>
	);
}
