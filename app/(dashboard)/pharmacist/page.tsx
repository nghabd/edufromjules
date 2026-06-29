import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PharmacistDashboard as PharmacistDashboardClient } from "@/components/Dashboard/PharmacistDashboard";

export default async function PharmacistDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PHARMACIST") redirect("/login");

  return <PharmacistDashboardClient />;
}
