"use client";

import { useState, useEffect, type ElementType, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
	User,
	Phone,
	Award,
	Building,
	MapPin,
	Briefcase,
	Edit2,
	Save,
	X,
	Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Profile = {
	phoneNumber?: string | null;
	licenseNumber?: string | null;
	specialization?: string | null;
	yearsOfExperience?: number | null;
	pharmacyName?: string | null;
	address?: string | null;
	bio?: string | null;
	city?: string | null;
};

type UserData = {
	id: string;
	name: string | null;
	email: string;
	role: string;
	createdAt: string;
	profile?: Profile | null;
	_count: { certificates: number; quizAttempts: number };
};

type ProfileForm = Partial<Profile & { name: string }>;
type ProfileFieldName = keyof ProfileForm;

type ProfileFieldProps = {
	label: string;
	icon: ElementType;
	field: ProfileFieldName;
	editing: boolean;
	value: string;
	displayValue: ReactNode;
	type?: string;
	onChange: (field: ProfileFieldName, value: string) => void;
};

function ProfileField({
	label,
	icon: Icon,
	field,
	editing,
	value,
	displayValue,
	type = "text",
	onChange,
}: ProfileFieldProps) {
	return (
		<div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
			<Icon className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400" />
			<div className="min-w-0 flex-1">
				<p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
					{label}
				</p>
				{editing ? (
					<Input
						type={type}
						value={value}
						onChange={(e) => onChange(field, e.target.value)}
						className="h-8 text-sm"
						placeholder={`Enter ${label.toLowerCase()}`}
					/>
				) : (
					<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
						{displayValue}
					</p>
				)}
			</div>
		</div>
	);
}

export function ProfilePanel() {
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [form, setForm] = useState<ProfileForm>({});

	const { data, isLoading } = useQuery<{ user: UserData }>({
		queryKey: ["profile"],
		queryFn: async () => (await axios.get("/api/profile")).data,
	});

	useEffect(() => {
		if (!data?.user) return;
		const frame = window.requestAnimationFrame(() => {
			setForm({
				name: data.user.name ?? "",
				...(data.user.profile ?? {}),
			});
		});
		return () => window.cancelAnimationFrame(frame);
	}, [data]);

	const update = useMutation({
		mutationFn: async (values: typeof form) =>
			axios.patch("/api/profile", values),
		onSuccess: () => {
			toast.success("Profile updated");
			setEditing(false);
			queryClient.invalidateQueries({ queryKey: ["profile"] });
		},
		onError: () => toast.error("Failed to update profile"),
	});

	if (isLoading) {
		return (
			<div className="space-y-4">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
				))}
			</div>
		);
	}

	const user = data?.user;
	if (!user) return null;

	const roleColors: Record<string, string> = {
		ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		SUPERVISOR: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
		PHARMACIST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	};

	const setFieldValue = (field: ProfileFieldName, value: string) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const renderFieldValue = (field: ProfileFieldName) => {
		const value =
			(user.profile?.[field as keyof Profile] as string) ||
			(field === "name" ? user.name : null);

		return value ? (
			value
		) : (
			<span className="font-normal italic text-slate-400">Not set</span>
		);
	};

	return (
		<div className="space-y-6">
			{/* Header Card */}
			<Card className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-4">
						<div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
							{(user.name ?? user.email).charAt(0).toUpperCase()}
						</div>
						<div>
							<h2 className="text-xl font-bold">{user.name ?? "Unnamed User"}</h2>
							<p className="text-blue-200 text-sm">{user.email}</p>
							<span
								className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[user.role] ?? ""}`}
							>
								{user.role}
							</span>
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="text-white hover:bg-white/20"
						onClick={() => {
							if (editing) {
								setForm({
									name: user.name ?? "",
									...(user.profile ?? {}),
								});
								setEditing(false);
							} else {
								setEditing(true);
							}
						}}
					>
						{editing ? (
							<><X className="h-4 w-4 mr-1.5" /> Cancel</>
						) : (
							<><Edit2 className="h-4 w-4 mr-1.5" /> Edit</>
						)}
					</Button>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
					{[
						{ label: "Certificates", value: user._count.certificates },
						{ label: "Quiz Attempts", value: user._count.quizAttempts },
						{
							label: "Member Since",
							value: new Date(user.createdAt).getFullYear(),
						},
					].map((s) => (
						<div key={s.label} className="text-center">
							<p className="text-xl font-bold">{s.value}</p>
							<p className="text-xs text-blue-200">{s.label}</p>
						</div>
					))}
				</div>
			</Card>

			{/* Details Card */}
			<Card className="p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-semibold text-slate-900 dark:text-white">
						Personal Details
					</h3>
					{editing && (
						<Button
							size="sm"
							onClick={() => update.mutate(form)}
							disabled={update.isPending}
							className="bg-blue-600 hover:bg-blue-700 text-white"
						>
							<Save className="h-4 w-4 mr-1.5" />
							{update.isPending ? "Saving..." : "Save Changes"}
						</Button>
					)}
				</div>

				<ProfileField
					label="Full Name"
					icon={User}
					field="name"
					editing={editing}
					value={(form.name as string) ?? ""}
					displayValue={renderFieldValue("name")}
					onChange={setFieldValue}
				/>
				<ProfileField
					label="Phone Number"
					icon={Phone}
					field="phoneNumber"
					editing={editing}
					value={(form.phoneNumber as string) ?? ""}
					displayValue={renderFieldValue("phoneNumber")}
					onChange={setFieldValue}
				/>
				<ProfileField
					label="License Number"
					icon={Award}
					field="licenseNumber"
					editing={editing}
					value={(form.licenseNumber as string) ?? ""}
					displayValue={renderFieldValue("licenseNumber")}
					onChange={setFieldValue}
				/>
				<ProfileField
					label="Specialization"
					icon={Star}
					field="specialization"
					editing={editing}
					value={(form.specialization as string) ?? ""}
					displayValue={renderFieldValue("specialization")}
					onChange={setFieldValue}
				/>
				<ProfileField
					label="Years of Experience"
					icon={Briefcase}
					field="yearsOfExperience"
					editing={editing}
					value={(form.yearsOfExperience?.toString() as string) ?? ""}
					displayValue={renderFieldValue("yearsOfExperience")}
					type="number"
					onChange={setFieldValue}
				/>
				<ProfileField
					label="Pharmacy Name"
					icon={Building}
					field="pharmacyName"
					editing={editing}
					value={(form.pharmacyName as string) ?? ""}
					displayValue={renderFieldValue("pharmacyName")}
					onChange={setFieldValue}
				/>
				<ProfileField
					label="Address"
					icon={MapPin}
					field="address"
					editing={editing}
					value={(form.address as string) ?? ""}
					displayValue={renderFieldValue("address")}
					onChange={setFieldValue}
				/>
			</Card>

			{/* Bio Card */}
			<Card className="p-6">
				<div className="flex items-center justify-between mb-3">
					<h3 className="font-semibold text-slate-900 dark:text-white">Bio</h3>
				</div>
				{editing ? (
					<textarea
						className="w-full h-28 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
						value={form.bio ?? ""}
						onChange={(e) =>
							setForm((f) => ({ ...f, bio: e.target.value }))
						}
						placeholder="Tell us about yourself..."
					/>
				) : (
					<p className="text-sm text-slate-600 dark:text-slate-400">
						{user.profile?.bio || (
							<span className="italic text-slate-400">No bio added yet.</span>
						)}
					</p>
				)}
			</Card>
		</div>
	);
}
