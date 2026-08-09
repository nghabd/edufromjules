import { requireRoles } from "@/lib/auth-guard";
import { PharmacistDashboard as PharmacistDashboardClient } from "@/components/Dashboard/PharmacistDashboard";

export default async function PharmacistDashboardPage() {
	await requireRoles(["PHARMACIST"]);
	return <PharmacistDashboardClient />;
}
