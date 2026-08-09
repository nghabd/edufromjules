import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

const benefits = [
	"Free to get started",
	"No credit card required",
	"Instant access to all courses",
];

export const CTASection = () => (
	<section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
		{/* Background */}
		<div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900" />

		{/* Animated Background Elements */}
		<div className="absolute inset-0 overflow-hidden opacity-20">
			<div className="absolute -top-40 -right-40 w-80 h-80 bg-white rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
			<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white rounded-full mix-blend-multiply filter blur-3xl animation-delay-2000" />
		</div>

		<div className="relative z-10 max-w-4xl mx-auto text-center">
			<div className="space-y-6">
				<h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
					Ready to transform your pharmacy training?
				</h2>

				<p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
					Join thousands of pharmacists already improving their skills with
					edustation. Get started today and access comprehensive courses
					immediately.
				</p>

				{/* Benefits */}
				<div className="grid md:grid-cols-3 gap-4 pt-6 pb-8">
					{benefits.map((benefit) => (
						<div
							key={benefit}
							className="flex items-center justify-center gap-2 text-blue-50"
						>
							<CheckCircle className="w-5 h-5 flex-shrink-0" />
							<span className="text-sm font-medium">{benefit}</span>
						</div>
					))}
				</div>

				{/* CTA Buttons */}
				<div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
					<Link href="/register">
						<Button
							size="lg"
							className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
						>
							Create Free Account
							<ArrowRight className="ml-2 w-4 h-4" />
						</Button>
					</Link>
					<Link href="/login">
						<Button
							variant="outline"
							size="lg"
							className="w-full sm:w-auto border-white text-white hover:bg-white/10 font-semibold"
						>
							Already have an account?
						</Button>
					</Link>
				</div>

				<p className="text-xs text-blue-100 pt-4">
					30-second setup. No spam. Unsubscribe anytime.
				</p>
			</div>
		</div>
	</section>
);
