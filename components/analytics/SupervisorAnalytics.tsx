"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
	ResponsiveContainer,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
} from "recharts";
import {
	Users,
	TrendingUp,
	AlertTriangle,
	Award,
	Download,
	ChevronDown,
	ChevronUp,
	CheckCircle2,
	Clock,
	XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { format } from "date-fns";

type PharmacistStat = {
	id: string;
	name?: string | null;
	email: string;
	totalAssignments: number;
	completedAssignments: number;
	overdueAssignments: number;
	completionRate: number;
	avgQuizScore?: number | null;
	certificates: number;
	courses: Array<{
		courseId: string;
		courseTitle: string;
		status: string;
		dueDate?: string | null;
		overdue?: boolean;
	}>;
};

type SupervisorAnalyticsData = {
	pharmacistStats: PharmacistStat[];
	totals: {
		pharmacists: number;
		totalAssignments: number;
		completedAssignments: number;
		overdueAssignments: number;
		totalCertificates: number;
	};
};

export function SupervisorAnalytics() {
	const [search, setSearch] = useState("");
	const [expanded, setExpanded] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);

	useRealtimeQueryInvalidation({
		events: [REALTIME_EVENTS.supervisorChanged, REALTIME_EVENTS.progressChanged, REALTIME_EVENTS.assignmentChanged],
		queryKeys: [["supervisor-analytics"]],
	});

	const { data, isLoading } = useQuery<SupervisorAnalyticsData>({
		queryKey: ["supervisor-analytics"],
		queryFn: async () => (await axios.get("/api/supervisor/analytics")).data,
		refetchInterval: 60_000,
	});

	const handleExport = async () => {
		setExporting(true);
		try {
			const res = await axios.get("/api/supervisor/export", {
				responseType: "blob",
			});
			const url = URL.createObjectURL(new Blob([res.data]));
			const a = document.createElement("a");
			a.href = url;
			a.download = `team-progress-${format(new Date(), "yyyy-MM-dd")}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("Export downloaded");
		} catch {
			toast.error("Export failed");
		} finally {
			setExporting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
				))}
			</div>
		);
	}

	const { pharmacistStats = [], totals } = data ?? {};
	const filtered = pharmacistStats.filter(
		(p) =>
			(p.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
			p.email.toLowerCase().includes(search.toLowerCase()),
	);

	const chartData = pharmacistStats.slice(0, 8).map((p) => ({
		name: (p.name ?? p.email).split(" ")[0],
		rate: p.completionRate,
		score: p.avgQuizScore ?? 0,
	}));

	const statusIcon: Record<string, React.ReactNode> = {
		COMPLETED: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
		ASSIGNED: <Clock className="h-3.5 w-3.5 text-blue-500" />,
		IN_PROGRESS: <Clock className="h-3.5 w-3.5 text-amber-500" />,
	};

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			{totals && (
				<div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
					{[
						{ label: "Team Members", value: totals.pharmacists, icon: Users, color: "bg-blue-600" },
						{ label: "Assignments", value: totals.totalAssignments, icon: TrendingUp, color: "bg-violet-600" },
						{ label: "Completed", value: totals.completedAssignments, icon: CheckCircle2, color: "bg-emerald-600" },
						{ label: "Overdue", value: totals.overdueAssignments, icon: AlertTriangle, color: totals.overdueAssignments > 0 ? "bg-red-500" : "bg-slate-400" },
						{ label: "Certificates", value: totals.totalCertificates, icon: Award, color: "bg-amber-500" },
					].map((s) => (
						<Card key={s.label} className="p-4 flex items-center gap-3">
							<div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color}`}>
								<s.icon className="h-4 w-4 text-white" />
							</div>
							<div>
								<p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
								<p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
							</div>
						</Card>
					))}
				</div>
			)}

			{/* Chart */}
			{chartData.length > 0 && (
				<Card className="p-6">
					<h3 className="font-semibold text-slate-900 dark:text-white mb-4">
						Team Completion Rate
					</h3>
					<ResponsiveContainer width="100%" height={220}>
						<BarChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
							<XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
							<YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
							<Tooltip
								formatter={(value) =>
									`${Array.isArray(value) ? value[0] : value ?? 0}%`
								}
								contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
							/>
							<Bar dataKey="rate" name="Completion %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</Card>
			)}

			{/* Table Header */}
			<div className="flex items-center justify-between gap-3">
				<Input
					placeholder="Search team members..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="max-w-xs h-9"
				/>
				<Button
					variant="outline"
					size="sm"
					onClick={handleExport}
					disabled={exporting}
					className="gap-2"
				>
					<Download className="h-4 w-4" />
					{exporting ? "Exporting..." : "Export CSV"}
				</Button>
			</div>

			{/* Pharmacist List */}
			<div className="space-y-2">
				{filtered.length === 0 && (
					<div className="py-12 text-center text-slate-500 dark:text-slate-400">
						No team members found
					</div>
				)}
				{filtered.map((p) => (
					<Card key={p.id} className="overflow-hidden">
						<button
							className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
							onClick={() => setExpanded(expanded === p.id ? null : p.id)}
						>
							<div className="flex items-center justify-between gap-4">
								<div className="flex items-center gap-3 min-w-0">
									<div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
										{(p.name ?? p.email).charAt(0).toUpperCase()}
									</div>
									<div className="min-w-0">
										<p className="font-medium text-slate-900 dark:text-white truncate">
											{p.name ?? p.email}
										</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 truncate">
											{p.email}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-4 flex-shrink-0">
									<div className="hidden sm:flex items-center gap-3 text-sm">
										<span className="text-slate-500">
											{p.completedAssignments}/{p.totalAssignments} courses
										</span>
										<div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
											<div
												className="h-full rounded-full bg-blue-500"
												style={{ width: `${p.completionRate}%` }}
											/>
										</div>
										<span className="font-semibold text-slate-700 dark:text-slate-300">
											{p.completionRate}%
										</span>
									</div>
									{p.overdueAssignments > 0 && (
										<Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
											{p.overdueAssignments} overdue
										</Badge>
									)}
									{p.certificates > 0 && (
										<Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
											<Award className="h-3 w-3 mr-1" />
											{p.certificates}
										</Badge>
									)}
									{expanded === p.id ? (
										<ChevronUp className="h-4 w-4 text-slate-400" />
									) : (
										<ChevronDown className="h-4 w-4 text-slate-400" />
									)}
								</div>
							</div>
						</button>

						{expanded === p.id && (
							<div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
								<div className="pt-3 space-y-2">
									{p.courses.length === 0 ? (
										<p className="text-sm text-slate-400 py-2">No courses assigned</p>
									) : (
										p.courses.map((c) => (
											<div
												key={c.courseId}
												className="flex items-center gap-3 py-1.5"
											>
												{statusIcon[c.status] ?? <XCircle className="h-3.5 w-3.5 text-slate-400" />}
												<span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
													{c.courseTitle}
												</span>
												<div className="flex items-center gap-2">
													{c.dueDate && (
														<span className={`text-xs ${c.overdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
															{c.overdue ? "Overdue" : `Due ${format(new Date(c.dueDate), "d MMM")}`}
														</span>
													)}
													<Badge
														className={
															c.status === "COMPLETED"
																? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
																: c.overdue
																	? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
																	: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
														}
													>
														{c.status}
													</Badge>
												</div>
											</div>
										))
									)}
									{p.avgQuizScore !== null && p.avgQuizScore !== undefined && (
										<div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
											<TrendingUp className="h-4 w-4" />
											Avg quiz score:{" "}
											<span className="font-semibold text-slate-900 dark:text-white">
												{p.avgQuizScore}%
											</span>
										</div>
									)}
								</div>
							</div>
						)}
					</Card>
				))}
			</div>
		</div>
	);
}
