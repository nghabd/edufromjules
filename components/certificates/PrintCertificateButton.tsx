"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintCertificateButton() {
	return (
		<div className="no-print flex w-full justify-end">
			<Button onClick={() => window.print()}>
				<Printer className="mr-2 h-4 w-4" />
				Print / Save as PDF
			</Button>
		</div>
	);
}