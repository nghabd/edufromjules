"use client";

import { useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OnsiteApprovalForm({ progressId }: { progressId: string }) {
	const [expertEmail, setExpertEmail] = useState("");
	const [expertPassword, setExpertPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [approvedBy, setApprovedBy] = useState<string | null>(null);

	const submitApproval = async (event: FormEvent) => {
		event.preventDefault();
		setIsSubmitting(true);

		try {
			const response = await axios.post("/api/pharmacist/quick-approve", {
				progressId,
				expertEmail,
				expertPassword,
			});
			const expertName = response.data.expertName || "trainer";
			setApprovedBy(expertName);
			toast.success("Onsite training approved");
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				const message = error.response?.data?.message;
				toast.error(
					typeof message === "string" ? message : "Approval failed",
				);
			} else {
				toast.error("Approval failed");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (approvedBy) {
		return (
			<div className="rounded-md border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
				<CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-600" />
				<p className="font-semibold text-green-900 dark:text-green-200">
					Approved by {approvedBy}
				</p>
				<p className="mt-1 text-sm text-green-700 dark:text-green-300">
					The assigned pharmacist can return to their learning path.
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={submitApproval} className="space-y-4">
			<div className="rounded-md border border-border bg-muted/30 p-3">
				<div className="flex items-center gap-2 text-sm font-medium">
					<ShieldCheck className="h-4 w-4 text-primary" />
					Trainer verification
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					Use the trainer pharmacist account to approve this onsite task.
				</p>
			</div>
			<label className="block space-y-1 text-sm font-medium">
				<span>Trainer email</span>
				<Input
					type="email"
					value={expertEmail}
					onChange={(event) => setExpertEmail(event.target.value)}
					required
				/>
			</label>
			<label className="block space-y-1 text-sm font-medium">
				<span>Password</span>
				<Input
					type="password"
					value={expertPassword}
					onChange={(event) => setExpertPassword(event.target.value)}
					required
				/>
			</label>
			<Button
				type="submit"
				className="w-full"
				disabled={isSubmitting || !expertEmail || !expertPassword}
			>
				{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
				Approve Onsite Training
			</Button>
		</form>
	);
}
