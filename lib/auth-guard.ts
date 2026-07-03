import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Role } from "@/lib/api-auth";
import { getDashboardPath } from "@/lib/auth-routing";

export async function getOptionalSession(): Promise<Session | null> {
	return getServerSession(authOptions);
}

export async function requireSession(): Promise<Session> {
	const session = await getOptionalSession();
	if (!session?.user?.id) {
		redirect("/login");
	}
	return session;
}

export async function requireRoles(roles: Role[]): Promise<Session> {
	const session = await requireSession();
	const userRole = session.user.role as Role;

	if (!roles.includes(userRole)) {
		redirect("/unauthorized");
	}

	return session;
}

export async function redirectIfAuthenticated(): Promise<void> {
	const session = await getOptionalSession();
	if (session?.user?.role) {
		redirect(getDashboardPath(session.user.role));
	}
}
