"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { dashboardPathByRole } from "@/lib/routes";

export function useAuthRedirect() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		// Wait until the session is fully loaded before taking action
		if (status !== "authenticated" || !session?.user?.role) return;

		// Determine where they should go based on their role
		const targetPath = dashboardPathByRole[session.user.role] ?? "/pharmacist";

		// Only redirect if they aren't already on their target dashboard
		// This prevents router.replace() from infinitely looping
		if (pathname !== targetPath) {
			router.replace(targetPath);
		}
	}, [router, pathname, session, status]);
}
