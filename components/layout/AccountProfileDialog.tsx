"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Camera, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { PasswordChangeForm } from "@/components/account/PasswordChangeForm";
import { DefaultAccountAvatar } from "@/components/layout/DefaultAccountAvatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MAX_PROFILE_IMAGE_BYTES = 1_000_000;

type AccountProfileDialogProps = {
	user: {
		name?: string | null;
		email?: string | null;
		role?: string | null;
		image?: string | null;
	};
	onOpenChange?: (open: boolean) => void;
};

type AccountProfileResponse = {
	profile: {
		groupName?: string | null;
		supervisor?: {
			id: string;
			name?: string | null;
			email: string;
			image?: string | null;
		} | null;
	};
};

export function AccountProfileDialog({
	user,
	onOpenChange,
}: AccountProfileDialogProps) {
	const { update } = useSession();
	const [open, setOpen] = useState(false);
	const [imageOverride, setImageOverride] = useState<string | null>();
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [savingImage, setSavingImage] = useState(false);
	const previewObjectUrlRef = useRef<string | null>(null);
	const imagePreview =
		imageOverride === undefined ? (user.image ?? null) : imageOverride;

	const { data: profileData } = useQuery<AccountProfileResponse>({
		queryKey: ["account-profile"],
		queryFn: async () => {
			const response = await fetch("/api/account/profile");
			if (!response.ok) throw new Error("Profile failed");
			return response.json();
		},
		enabled: open,
	});

	const supervisor = profileData?.profile.supervisor ?? null;

	useEffect(() => {
		return () => {
			if (previewObjectUrlRef.current) {
				URL.revokeObjectURL(previewObjectUrlRef.current);
			}
		};
	}, []);

	const clearObjectPreview = () => {
		if (previewObjectUrlRef.current) {
			URL.revokeObjectURL(previewObjectUrlRef.current);
			previewObjectUrlRef.current = null;
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
		if (!nextOpen) {
			setSelectedImage(null);
			clearObjectPreview();
			setImageOverride(undefined);
		}
	};

	const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		setSelectedImage(file);
		clearObjectPreview();

		if (!file) {
			setImageOverride(undefined);
			return;
		}

		if (!file.type.startsWith("image/")) {
			toast.error("Choose an image file.");
			event.target.value = "";
			setSelectedImage(null);
			return;
		}

		if (file.size > MAX_PROFILE_IMAGE_BYTES) {
			toast.error("Profile image must be smaller than 1 MB.");
			event.target.value = "";
			setSelectedImage(null);
			return;
		}

		const previewUrl = URL.createObjectURL(file);
		previewObjectUrlRef.current = previewUrl;
		setImageOverride(previewUrl);
	};

	const syncSessionImage = async (image: string | null) => {
		await update({
			user: {
				name: user.name,
				email: user.email,
				role: user.role,
				image,
			},
		});
	};

	const saveImage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedImage) return;

		setSavingImage(true);
		try {
			const formData = new FormData();
			formData.set("image", selectedImage);
			const response = await fetch("/api/account/profile-image", {
				method: "PATCH",
				body: formData,
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				toast.error(payload.message || "Profile image could not be updated.");
				return;
			}

			setSelectedImage(null);
			clearObjectPreview();
			setImageOverride(payload.image ?? null);
			await syncSessionImage(payload.image ?? null);
			toast.success("Profile image updated.");
		} catch {
			toast.error("Profile image could not be updated.");
		} finally {
			setSavingImage(false);
		}
	};

	const removeImage = async () => {
		setSavingImage(true);
		try {
			const formData = new FormData();
			formData.set("remove", "true");
			const response = await fetch("/api/account/profile-image", {
				method: "PATCH",
				body: formData,
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				toast.error(payload.message || "Profile image could not be removed.");
				return;
			}

			setSelectedImage(null);
			clearObjectPreview();
			setImageOverride(null);
			await syncSessionImage(null);
			toast.success("Profile image removed.");
		} catch {
			toast.error("Profile image could not be removed.");
		} finally {
			setSavingImage(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					className="h-10 w-10 rounded-full p-0"
					aria-label="Account settings"
				>
					<DefaultAccountAvatar
						label={user.name || user.email}
						image={user.image}
					/>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Account</DialogTitle>
					<DialogDescription>
						{user.name || user.email}
						{user.role ? ` - ${user.role.toLowerCase()}` : ""}
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="profile" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="profile">Profile</TabsTrigger>
						<TabsTrigger value="password">Password</TabsTrigger>
					</TabsList>

					<TabsContent value="profile" className="mt-5">
						<form onSubmit={saveImage} className="space-y-5">
							<div className="flex items-center gap-4">
								<DefaultAccountAvatar
									label={user.name || user.email}
									image={imagePreview}
									className="h-20 w-20"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
										{user.name || "User"}
									</p>
									<p className="truncate text-xs text-slate-500 dark:text-slate-400">
										{user.email}
									</p>
								</div>
							</div>

							{user.role === "PHARMACIST" && (
								<div className="rounded-md border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
									<div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
										<ShieldCheck className="h-4 w-4" />
										Supervisor
									</div>
									{supervisor ? (
										<div className="flex items-center gap-3">
											<DefaultAccountAvatar
												label={supervisor.name || supervisor.email}
												image={supervisor.image}
											/>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium text-slate-900 dark:text-white">
													{supervisor.name || "Supervisor"}
												</p>
												<p className="truncate text-xs text-slate-600 dark:text-slate-400">
													{supervisor.email}
												</p>
											</div>
										</div>
									) : (
										<p className="text-sm text-slate-600 dark:text-slate-400">
											No supervisor assigned yet.
										</p>
									)}
									{profileData?.profile.groupName && (
										<p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
											Group: {profileData.profile.groupName}
										</p>
									)}
								</div>
							)}

							<div>
								<label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
									Profile image
								</label>
								<Input
									type="file"
									accept="image/jpeg,image/png,image/webp,image/gif"
									onChange={handleImageChange}
									disabled={savingImage}
								/>
							</div>

							<div className="flex flex-col gap-2 sm:flex-row">
								<Button
									type="submit"
									disabled={!selectedImage || savingImage}
									className="gap-2"
								>
									{savingImage ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Camera className="h-4 w-4" />
									)}
									Update image
								</Button>
								<Button
									type="button"
									variant="outline"
									disabled={savingImage || !imagePreview}
									onClick={removeImage}
									className="gap-2"
								>
									<Trash2 className="h-4 w-4" />
									Remove
								</Button>
							</div>
						</form>
					</TabsContent>

					<TabsContent value="password" className="mt-5">
						<PasswordChangeForm />
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
