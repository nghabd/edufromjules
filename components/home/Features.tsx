import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	BookOpen,
	ClipboardCheck,
	Users,
	TrendingUp,
	Zap,
	Shield,
} from "lucide-react";

const features = [
	{
		icon: BookOpen,
		title: "Rich Materials",
		desc: "Videos & PDFs on every topic with multimedia support",
		color: "text-blue-600 dark:text-blue-400",
	},
	{
		icon: ClipboardCheck,
		title: "Mandatory Quizzes",
		desc: "Assess understanding after each tutorial",
		color: "text-green-600 dark:text-green-400",
	},
	{
		icon: Users,
		title: "Role‑based Access",
		desc: "Pharmacist · Supervisor · Admin",
		color: "text-purple-600 dark:text-purple-400",
	},
	{
		icon: TrendingUp,
		title: "Real‑time Progress",
		desc: "Live dashboards and completion stats",
		color: "text-orange-600 dark:text-orange-400",
	},
	{
		icon: Zap,
		title: "Lightning Fast",
		desc: "Optimized performance and quick loading",
		color: "text-yellow-600 dark:text-yellow-400",
	},
	{
		icon: Shield,
		title: "Secure & Private",
		desc: "Enterprise-grade security for your data",
		color: "text-red-600 dark:text-red-400",
	},
];

export const Features = () => (
	<section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900/50">
		<div className="max-w-6xl mx-auto">
			<div className="text-center mb-16">
				<h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
					Everything you need to train your pharmacy team
				</h2>
				<p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
					Comprehensive tools designed specifically for pharmacy education and
					professional development
				</p>
			</div>

			<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
				{features.map(({ icon: Icon, title, desc, color }) => (
					<Card
						key={title}
						className="group relative hover:shadow-xl dark:hover:shadow-lg transition-all duration-300 overflow-hidden border-slate-200 dark:border-slate-700"
					>
						{/* Gradient Background on Hover */}
						<div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

						<CardHeader className="relative">
							<div className="flex items-center gap-4 mb-3">
								<div
									className={`p-3 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors duration-300`}
								>
									<Icon
										className={`w-6 h-6 ${color} transition-transform group-hover:scale-110 duration-300`}
									/>
								</div>
							</div>
							<CardTitle className="text-xl text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
								{title}
							</CardTitle>
						</CardHeader>

						<CardContent className="relative">
							<p className="text-slate-600 dark:text-slate-400 leading-relaxed">
								{desc}
							</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	</section>
);
