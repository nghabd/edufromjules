import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SupervisorDashboard as SupervisorDashboardClient } from "@/components/Dashboard/SupervisorDashboard";

export default async function SupervisorDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") redirect("/login");

  return <SupervisorDashboardClient />;
}
