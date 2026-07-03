import type { Role } from "@/lib/api-auth";

export const DASHBOARD_PATH_BY_ROLE: Record<string, string> = {
	ADMIN: "/admin",
	SUPERVISOR: "/supervisor",
	PHARMACIST: "/pharmacist",
};

/** Route prefix -> roles allowed to access it */
export const ROUTE_ROLE_ACCESS: Record<string, Role[]> = {
	"/admin": ["ADMIN"],
	"/supervisor": ["SUPERVISOR", "ADMIN"],
	"/pharmacist": ["PHARMACIST"],
};

const PROTECTED_PREFIXES = Object.keys(ROUTE_ROLE_ACCESS);

export function getDashboardPath(role: string): string {
	return DASHBOARD_PATH_BY_ROLE[role] ?? "/pharmacist";
}

export function isProtectedRoute(path: string): boolean {
	if (path.startsWith("/pharmacist/approve")) return false;
	return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function getRequiredRoles(path: string): Role[] | null {
	for (const [prefix, roles] of Object.entries(ROUTE_ROLE_ACCESS)) {
		if (path.startsWith(prefix)) {
			return roles;
		}
	}
	return null;
}

export function canAccessRoute(path: string, role: string): boolean {
	const requiredRoles = getRequiredRoles(path);
	if (!requiredRoles) return true;
	return requiredRoles.includes(role as Role);
}

export function getPageRolesForDashboard(path: string): Role[] {
	const requiredRoles = getRequiredRoles(path);
	return requiredRoles ?? [];
}
