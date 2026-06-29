"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Legend,
} from "recharts";
import {
	Users,
	BookOpen,
	Award,
	TrendingUp,
	AlertTriangle,
	Shield,
	UserCheck,
	GraduationCap,
	Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRealtimeQueryInvalidation } from "@/components/realtime/useRealtimeQueryInvalidation";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";

type AnalyticsData = {
	stats: {
		totalUsers: number;
		admins: number;
		supervisors: number;
		pharmacists: number;
		totalCourses: number;
		totalAssignments: number;
		completedAssignments: number;
		overdueAssignments: number;
		completionRate: number;
		totalCertificates: number;
	};
	chartData: Array<{
		date: string;
		enrollments: number;
		completions: number;
	}>;
	recentActivity: Array<{
		id: string;
		title: string;
		message: string;
		type: string;
		createdAt: string;
		user: { name?: string | null; email: string; role: string };
	}>;
};

const StatCard = ({
	icon: Icon,
	label,
	value,
	sub,
	color,
}: {
	icon: React.ElementType;
	label: string;
	value: string | number;
	sub?: string;
	color: string;
}) => (
	<Card className="p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
		<div
			className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
		>
			<Icon className="h-5 w-5 text-white" />
		</div>
		<div>
			<p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
			<p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
			{sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
		</div>
	</Card>
);

const activityColors: Record<string, string> = {
	SUCCESS: "bg-green-500",
	ERROR: "bg-red-500",
	WARNING: "bg-amber-500",
	INFO: "bg-blue-500",
};

export function AdminAnalytics() {
	useRealtimeQueryInvalidation({
		events: [REALTIME_EVENTS.analyticsChanged, REALTIME_EVENTS.adminChanged, REALTIME_EVENTS.assignmentChanged, REALTIME_EVENTS.certificateIssued],
		queryKeys: [["admin-analytics"]],
	});

	const { data, isLoading } = useQuery<AnalyticsData>({
		queryKey: ["admin-analytics"],
		queryFn: async () => (await axios.get("/api/admin/analytics")).data,
		refetchInterval: 60_000,
	});

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
					{[...Array(8)].map((_, i) => (
						<div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
					))}
				</div>
				<div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
			</div>
		);
	}

	const { stats, chartData, recentActivity } = data ?? {
		stats: {} as AnalyticsData["stats"],
		chartData: [],
		recentActivity: [],
	};

	const formattedChart = chartData.map((d) => ({
		...d,
		date: format(new Date(d.date), "dd MMM"),
	}));

	return (
		<div className="space-y-6">
			{/* KPI Grid */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-blue-600" />
				<StatCard icon={BookOpen} label="Courses" value={stats.totalCourses} color="bg-violet-600" />
				<StatCard icon={Award} label="Certificates" value={stats.totalCertificates} color="bg-amber-500" />
				<StatCard
					icon={TrendingUp}
					label="Completion Rate"
					value={`${stats.completionRate}%`}
					sub={`${stats.completedAssignments} of ${stats.totalAssignments}`}
					color="bg-emerald-600"
				/>
				<StatCard icon={Shield} label="Admins" value={stats.admins} color="bg-red-600" />
				<StatCard icon={UserCheck} label="Supervisors" value={stats.supervisors} color="bg-purple-600" />
				<StatCard icon={GraduationCap} label="Pharmacists" value={stats.pharmacists} color="bg-cyan-600" />
				<StatCard
					icon={AlertTriangle}
					label="Overdue"
					value={stats.overdueAssignments}
					sub="assignments past due"
					color={stats.overdueAssignments > 0 ? "bg-red-500" : "bg-slate-400"}
				/>
			</div>

			{/* Chart */}
			<Card className="p-6">
				<div className="flex items-center gap-2 mb-5">
					<Activity className="h-5 w-5 text-blue-600" />
					<h3 className="font-semibold text-slate-900 dark:text-white">
						30-Day Activity
					</h3>
				</div>
				<ResponsiveContainer width="100%" height={260}>
					<AreaChart data={formattedChart}>
						<defs>
							<linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
								<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
							</linearGradient>
							<linearGradient id="completeGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
								<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
						<XAxis
							dataKey="date"
							tick={{ fontSize: 11, fill: "#94a3b8" }}
							axisLine={false}
							tickLine={false}
							interval={4}
						/>
						<YAxis
							tick={{ fontSize: 11, fill: "#94a3b8" }}
							axisLine={false}
							tickLine={false}
						/>
						<Tooltip
							contentStyle={{
								background: "var(--background, #fff)",
								border: "1px solid #e2e8f0",
								borderRadius: "8px",
								fontSize: "12px",
							}}
						/>
						<Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
						<Area
							type="monotone"
							dataKey="enrollments"
							name="New Enrollments"
							stroke="#3b82f6"
							fill="url(#enrollGrad)"
							strokeWidth={2}
						/>
						<Area
							type="monotone"
							dataKey="completions"
							name="Certificates Issued"
							stroke="#10b981"
							fill="url(#completeGrad)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</Card>

			{/* Recent Activity */}
			<Card className="p-6">
				<div className="flex items-center gap-2 mb-4">
					<Activity className="h-5 w-5 text-blue-600" />
					<h3 className="font-semibold text-slate-900 dark:text-white">
						Recent Activity
					</h3>
				</div>
				<div className="space-y-1">
					{recentActivity.length === 0 ? (
						<p className="text-sm text-slate-400 py-6 text-center">
							No recent activity
						</p>
					) : (
						recentActivity.map((a) => (
							<div
								key={a.id}
								className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
							>
								<span
									className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${activityColors[a.type] ?? "bg-slate-400"}`}
								/>
								<div className="flex-1 min-w-0">
									<p className="text-sm text-slate-800 dark:text-slate-200">
										<span className="font-medium">
											{a.user.name ?? a.user.email}
										</span>{" "}
										— {a.message}
									</p>
								</div>
								<span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
									{formatDistanceToNow(new Date(a.createdAt), {
										addSuffix: true,
									})}
								</span>
							</div>
						))
					)}
				</div>
			</Card>
		</div>
	);
}
