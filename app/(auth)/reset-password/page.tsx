import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

type ResetPasswordPageProps = {
	searchParams: Promise<{
		token?: string | string[];
	}>;
};

export default async function ResetPasswordPage({
	searchParams,
}: ResetPasswordPageProps) {
	const params = await searchParams;
	const tokenParam = params.token;
	const token = Array.isArray(tokenParam) ? tokenParam[0] ?? "" : tokenParam ?? "";

	return (
		<div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
			<ResetPasswordForm token={token} />
		</div>
	);
}
