"use client";

import {
	BookOpen,
	MessageCircle,
	GraduationCap,
	Shield,
	Mail,
	Globe,
	ExternalLink,
	GitFork,
} from "lucide-react";

export const Footer = () => {
	return (
		<footer className="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
					{/* Brand */}
					<div className="lg:col-span-2 space-y-4">
						<button onClick={(e) => e.preventDefault()} className="flex items-center gap-2.5" aria-label="edustation home" title="Coming soon">
							<svg
								className="h-10 w-10"
								viewBox="0 0 32 32"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
							>
								<rect width="32" height="32" rx="8" fill="url(#grad)" />
								<defs>
									<linearGradient id="grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
										<stop offset="0%" stopColor="#2563EB" />
										<stop offset="100%" stopColor="#4F46E5" />
									</linearGradient>
								</defs>
								<path
									d="M16 6L24 12V20L16 26L8 20V12L16 6Z"
									stroke="white"
									strokeWidth="2"
									fill="none"
								/>
								<path d="M16 10V22" stroke="white" strokeWidth="2" strokeLinecap="round" />
								<path d="M10 16H22" stroke="white" strokeWidth="2" strokeLinecap="round" />
							</svg>
							<span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
								edustation
							</span>
						</button>
						<p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
							Secure pharmacy training platform for teams. Courses, quizzes, certificates, and role-based access.
						</p>
<div className="flex items-center gap-3 pt-2">
							<button onClick={(e) => e.preventDefault()} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="Twitter" title="Coming soon">
								<Globe className="h-5 w-5" />
							</button>
							<button onClick={(e) => e.preventDefault()} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="LinkedIn" title="Coming soon">
								<ExternalLink className="h-5 w-5" />
							</button>
							<button onClick={(e) => e.preventDefault()} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="GitHub" title="Coming soon">
								<GitFork className="h-5 w-5" />
							</button>
							<button onClick={(e) => e.preventDefault()} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="Email" title="Coming soon">
								<Mail className="h-5 w-5" />
							</button>
						</div>
					</div>

					{/* Product */}
					<nav className="space-y-3" aria-label="Product">
						<h3 className="font-semibold text-slate-900 dark:text-white">Product</h3>
						<ul className="space-y-2">
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 w-full text-left" title="Coming soon"><BookOpen className="h-4 w-4" /> Courses</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 w-full text-left" title="Coming soon"><GraduationCap className="h-4 w-4" /> Quizzes</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 w-full text-left" title="Coming soon"><MessageCircle className="h-4 w-4" /> Certificates</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 w-full text-left" title="Coming soon"><Shield className="h-4 w-4" /> Security</button></li>
						</ul>
					</nav>

					{/* Resources */}
					<nav className="space-y-3" aria-label="Resources">
						<h3 className="font-semibold text-slate-900 dark:text-white">Resources</h3>
						<ul className="space-y-2">
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Help Center</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Documentation</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">API Reference</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Changelog</button></li>
						</ul>
					</nav>

					{/* Company */}
					<nav className="space-y-3" aria-label="Company">
						<h3 className="font-semibold text-slate-900 dark:text-white">Company</h3>
						<ul className="space-y-2">
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">About Us</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Careers</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Blog</button></li>
							<li><button onClick={(e) => e.preventDefault()} className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Contact</button></li>
						</ul>
					</nav>
				</div>

				{/* Bottom Bar */}
				<div className="mt-10 pt-8 border-t border-slate-200/60 dark:border-slate-800/60">
					<div className="flex flex-col md:flex-row items-center justify-between gap-4">
						<p className="text-sm text-slate-500 dark:text-slate-400">
							&copy; {new Date().getFullYear()} edustation. All rights reserved.
						</p>
						<div className="flex items-center gap-6">
							<button onClick={(e) => e.preventDefault()} className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Privacy Policy</button>
							<button onClick={(e) => e.preventDefault()} className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Terms of Service</button>
							<button onClick={(e) => e.preventDefault()} className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Coming soon">Cookie Policy</button>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
};