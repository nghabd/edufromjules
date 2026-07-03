import { requireRoles } from "@/lib/auth-guard";
import { SupervisorDashboard as SupervisorDashboardClient } from "@/components/Dashboard/SupervisorDashboard";

export default async function SupervisorDashboardPage() {
	await requireRoles(["SUPERVISOR", "ADMIN"]);
	return <SupervisorDashboardClient />;
}
