"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Award, Download, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { format } from "date-fns";

type Certificate = {
	id: string;
	courseId: string;
	courseName: string;
	issueDate: string;
	expiryDate?: string | null;
};

export function CertificatesPanel() {
	useRealtimeQueryInvalidation({
		events: [REALTIME_EVENTS.certificateIssued, REALTIME_EVENTS.pharmacistChanged],
		queryKeys: [["certificates"]],
	});

	const { data, isLoading } = useQuery<{ certificates: Certificate[] }>({
		queryKey: ["certificates"],
		queryFn: async () => (await axios.get("/api/certificates")).data,
	});

	const certificates = data?.certificates ?? [];

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
				))}
			</div>
		);
	}

	if (certificates.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16">
				<div className="h-20 w-20 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
					<Award className="h-10 w-10 text-amber-400" />
				</div>
				<h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
					No certificates yet
				</h3>
				<p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
					Complete a course and pass all quizzes to earn your first certificate.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-slate-900 dark:text-white">
					Earned Certificates
				</h3>
				<Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
					{certificates.length} certificate{certificates.length !== 1 ? "s" : ""}
				</Badge>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{certificates.map((cert) => (
					<Card
						key={cert.id}
						className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-5"
					>
						{/* Decorative */}
						<div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-amber-200/30 dark:bg-amber-400/10" />
						<div className="absolute -bottom-6 -left-4 h-20 w-20 rounded-full bg-orange-200/20 dark:bg-orange-400/10" />

						<div className="relative">
							<div className="flex items-start gap-3">
								<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
									<Award className="h-5 w-5 text-white" />
								</div>
								<div className="flex-1 min-w-0">
									<h4 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
										{cert.courseName}
									</h4>
									<div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
										<Calendar className="h-3 w-3" />
										<span>
											Issued{" "}
											{format(new Date(cert.issueDate), "d MMM yyyy")}
										</span>
									</div>
									{cert.expiryDate && (
										<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
											Expires{" "}
											{format(new Date(cert.expiryDate), "d MMM yyyy")}
										</p>
									)}
								</div>
							</div>

							<div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-700/30 flex items-center justify-between">
								<span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
									Certificate of Completion
								</span>
								<button
									className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-medium transition-colors"
									onClick={() => {
										// Print/download the certificate
										window.print();
									}}
									title="Download certificate"
								>
									<Download className="h-3.5 w-3.5" />
									Download
								</button>
							</div>
						</div>
					</Card>
				))}
			</div>
		</div>
	);
}
