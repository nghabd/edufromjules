import { requireRoles } from "@/lib/auth-guard";
import { AdminDashboard as AdminDashboardClient } from "@/components/Dashboard/AdminDashboard";

export default async function AdminDashboardPage() {
	await requireRoles(["ADMIN"]);
	return <AdminDashboardClient />;
}
