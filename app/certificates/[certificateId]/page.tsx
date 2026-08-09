import Image from "next/image";
import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PrintCertificateButton } from "@/components/certificates/PrintCertificateButton";

type PageProps = {
	params: Promise<{ certificateId: string }>;
};

export default async function CertificatePage({ params }: PageProps) {
	const session = await requireRoles(["PHARMACIST", "SUPERVISOR", "ADMIN"]);
	const { certificateId } = await params;

	const certificate = await prisma.certificate.findUnique({
		where: { id: certificateId },
		include: {
			user: { select: { name: true, email: true } },
		},
	});

	if (!certificate) {
		notFound();
	}

	if (
		certificate.userId !== session.user.id &&
		session.user.role !== "ADMIN" &&
		session.user.role !== "SUPERVISOR"
	) {
		notFound();
	}

	const recipientName = certificate.user.name || certificate.user.email || "Pharmacist";
	const courseName = certificate.courseName;
	const issueDate = new Date(certificate.issueDate);
	const expiryDate = certificate.expiryDate ? new Date(certificate.expiryDate) : null;

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-slate-900 dark:text-white">
						Certificate of Completion
					</h1>
					<p className="text-sm text-slate-500 dark:text-slate-400">
						Print or save as PDF from your browser.
					</p>
				</div>
				<PrintCertificateButton />
			</div>

			<div className="certificate-sheet">
				<div className="certificate-inner">
					<div className="flex flex-col items-center gap-2">
						<span className="relative inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
							<Image
								src="/brand/edustation-gemini-logo.png"
								alt="edustation logo"
								width={256}
								height={256}
								unoptimized
								className="h-full w-full object-contain"
							/>
						</span>
						<div className="text-center">
							<p className="text-lg font-semibold uppercase tracking-[0.2em] text-slate-800">
								AL-Dawaa
							</p>
							<p className="text-xs uppercase tracking-[0.25em] text-slate-500">
								Continuous Training Program
							</p>
						</div>
					</div>

					<div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

					<div className="text-center">
						<p className="text-sm uppercase tracking-[0.35em] text-amber-600">
							Certificate of Completion
						</p>
						<h2 className="mt-3 text-4xl font-serif text-slate-900">
							This is to certify that
						</h2>
						<p className="mt-6 text-5xl font-serif italic text-slate-900">
							{recipientName}
						</p>
						<p className="mx-auto mt-6 max-w-2xl text-base text-slate-600">
							has successfully completed the continuous training course
						</p>
						<p className="mx-auto mt-2 max-w-2xl text-2xl font-semibold text-slate-800">
							&quot;{courseName}&quot;
						</p>
						<div className="mx-auto mt-8 max-w-md">
							<p className="text-sm text-slate-500">
								Awarded on{" "}
								{issueDate.toLocaleDateString("en-GB", {
									day: "numeric",
									month: "long",
									year: "numeric",
								})}
							</p>
							{expiryDate && (
								<p className="text-sm text-slate-500">
									Valid until{" "}
									{expiryDate.toLocaleDateString("en-GB", {
										day: "numeric",
										month: "long",
										year: "numeric",
									})}
								</p>
							)}
						</div>
					</div>

					<div className="mt-10 flex items-end justify-between">
						<div className="text-center">
							<p className="w-48 border-b border-slate-400 pb-1 text-sm font-medium text-slate-800">
								Training Coordinator
							</p>
							<p className="mt-2 text-xs text-slate-500">AL-Dawaa</p>
						</div>
						<div className="text-center">
							<p className="w-48 border-b border-slate-400 pb-1 text-sm font-medium text-slate-800">
								Quality &amp; Training Manager
							</p>
							<p className="mt-2 text-xs text-slate-500">AL-Dawaa</p>
						</div>
					</div>

					<p className="mt-8 border-t border-slate-200 pt-4 text-center text-xs tracking-wide text-slate-400">
						Certificate ID: {certificate.id} · Issued by edustation · AL-Dawaa
						Continuous Training Program
					</p>
				</div>
			</div>
		</div>
	);
}
