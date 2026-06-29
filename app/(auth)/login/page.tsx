import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { authOptions } from "@/lib/auth";
import { dashboardPathByRole } from "@/lib/routes";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role) {
    redirect(dashboardPathByRole[session.user.role] ?? "/pharmacist");
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
      <LoginForm />
    </div>
  );
}
