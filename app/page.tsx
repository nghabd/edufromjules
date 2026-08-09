import { getServerSession } from "next-auth";
import { HeroSection } from "@/components/home/HeroSection";
import { authOptions } from "@/lib/auth";
import { dashboardPathByRole } from "@/lib/routes";

export default async function HomePage() {
	const session = await getServerSession(authOptions);
	const dashboardPath = session?.user?.role
		? dashboardPathByRole[session.user.role] ?? "/pharmacist"
		: "/login";

	return (
		<div className="bg-background">
			<HeroSection
				dashboardPath={dashboardPath}
				userName={session?.user?.name ?? null}
				isAuthenticated={Boolean(session?.user?.role)}
			/>
		</div>
	);
}
