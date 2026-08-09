"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { getDashboardPath } from "@/lib/auth-routing";

export function useAuthRedirect() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (status !== "authenticated" || !session?.user?.role) return;

		const targetPath = getDashboardPath(session.user.role);

		if (pathname !== targetPath) {
			router.replace(targetPath);
		}
	}, [router, pathname, session, status]);
}
