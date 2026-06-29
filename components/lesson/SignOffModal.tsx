"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { Loader2, MapPinCheck, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	getRealtimeClient,
	REALTIME_CHANNEL,
	REALTIME_EVENTS,
} from "@/lib/realtime-client";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type PracticalApprovalEvent = {
	progressId?: string;
	userId?: string;
};

type TrainingLocation = {
	name: string;
	lat: number;
	lng: number;
	radiusMeters: number;
};

type LocationStatus =
	| "idle"
	| "checking"
	| "allowed"
	| "denied"
	| "unavailable";

interface SignOffModalProps {
	progressId: string;
	traineeId: string;
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

const DEFAULT_RADIUS_METERS = 150;

function configuredRadius() {
	const value = Number(process.env.NEXT_PUBLIC_ONSITE_TRAINING_RADIUS_METERS);
	return Number.isFinite(value) && value > 0 ? value : DEFAULT_RADIUS_METERS;
}

function parseTrainingLocations(): TrainingLocation[] {
	const raw = process.env.NEXT_PUBLIC_ONSITE_TRAINING_LOCATIONS;
	if (!raw) return [];

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map((location) => {
				if (typeof location !== "object" || location === null) return null;
				const source = location as Record<string, unknown>;
				const lat = Number(source.lat);
				const lng = Number(source.lng);
				const radiusMeters = Number(source.radiusMeters ?? configuredRadius());
				const name =
					typeof source.name === "string" && source.name.trim()
						? source.name.trim()
						: "Training pharmacy";

				if (
					!Number.isFinite(lat) ||
					!Number.isFinite(lng) ||
					!Number.isFinite(radiusMeters) ||
					radiusMeters <= 0
				) {
					return null;
				}

				return { name, lat, lng, radiusMeters };
			})
			.filter((location): location is TrainingLocation => Boolean(location));
	} catch {
		return [];
	}
}

function distanceMeters(
	from: { lat: number; lng: number },
	to: { lat: number; lng: number },
) {
	const earthRadiusMeters = 6_371_000;
	const toRadians = (value: number) => (value * Math.PI) / 180;
	const dLat = toRadians(to.lat - from.lat);
	const dLng = toRadians(to.lng - from.lng);
	const lat1 = toRadians(from.lat);
	const lat2 = toRadians(to.lat);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

	return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function SignOffModal({
	progressId,
	traineeId,
	isOpen,
	onClose,
	onSuccess,
}: SignOffModalProps) {
	const trainingLocations = useMemo(() => parseTrainingLocations(), []);
	const requiresLocation = trainingLocations.length > 0;
	const [locationStatus, setLocationStatus] = useState<LocationStatus>(
		requiresLocation ? "idle" : "allowed",
	);
	const [locationMessage, setLocationMessage] = useState("");
	const approvalUrl =
		typeof window === "undefined"
			? ""
			: `${window.location.origin}/pharmacist/approve/${progressId}`;
	const canShowQr = locationStatus === "allowed";

	useEffect(() => {
		if (!isOpen) return;

		// Listen to Pusher for the approval event
		const realtimeClient = getRealtimeClient();
		if (!realtimeClient) return;

		const channel = realtimeClient.subscribe(REALTIME_CHANNEL);
		const handleApproval = (data: PracticalApprovalEvent) => {
			if (data.progressId === progressId || data.userId === traineeId) {
				toast.success("Task approved");
				onSuccess();
				onClose();
			}
		};

		channel.bind("practical_approved", handleApproval);
		channel.bind(REALTIME_EVENTS.practicalApproved, handleApproval);

		return () => {
			channel.unbind("practical_approved", handleApproval);
			channel.unbind(REALTIME_EVENTS.practicalApproved, handleApproval);
			realtimeClient.unsubscribe(REALTIME_CHANNEL);
		};
	}, [isOpen, traineeId, progressId, onSuccess, onClose]);

	const checkLocation = () => {
		if (!requiresLocation) {
			setLocationStatus("allowed");
			return;
		}

		if (!navigator.geolocation) {
			setLocationStatus("unavailable");
			setLocationMessage("Location services are not available in this browser.");
			return;
		}

		setLocationStatus("checking");
		setLocationMessage("");

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const currentLocation = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				};
				const nearest = trainingLocations
					.map((location) => ({
						location,
						distance: distanceMeters(currentLocation, location),
					}))
					.sort((a, b) => a.distance - b.distance)[0];

				if (!nearest) {
					setLocationStatus("unavailable");
					setLocationMessage("No training pharmacy locations are configured.");
					return;
				}

				if (nearest.distance <= nearest.location.radiusMeters) {
					setLocationStatus("allowed");
					setLocationMessage(
						`Location verified at ${nearest.location.name}.`,
					);
					return;
				}

				setLocationStatus("denied");
				setLocationMessage(
					`You are about ${Math.round(nearest.distance)}m from ${nearest.location.name}. Move within ${nearest.location.radiusMeters}m to unlock sign-off.`,
				);
			},
			(error) => {
				setLocationStatus("unavailable");
				setLocationMessage(
					error.message ||
						"Location access was blocked. Allow location access and try again.",
				);
			},
			{
				enableHighAccuracy: true,
				maximumAge: 0,
				timeout: 15_000,
			},
		);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="text-center">
						Expert Sign-Off Required
					</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col items-center justify-center p-6 space-y-4">
					{requiresLocation && !canShowQr ? (
						<div className="w-full space-y-4 rounded-md border border-border bg-muted/30 p-4 text-center">
							<MapPinCheck className="mx-auto h-10 w-10 text-emerald-600" />
							<div>
								<p className="text-sm font-semibold">
									Verify onsite location
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									The trainer sign-off opens only when you are at an approved
									training pharmacy.
								</p>
							</div>
							{locationMessage && (
								<p className="rounded-md bg-background p-3 text-xs text-muted-foreground">
									{locationMessage}
								</p>
							)}
							<Button
								type="button"
								className="w-full"
								onClick={checkLocation}
								disabled={locationStatus === "checking"}
							>
								{locationStatus === "checking" ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<MapPinCheck className="mr-2 h-4 w-4" />
								)}
								Check Location
							</Button>
						</div>
					) : (
						<>
							{requiresLocation && locationMessage && (
								<p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
									{locationMessage}
								</p>
							)}
							<p className="text-sm text-center text-slate-500">
								Ask your trainer pharmacist to scan this QR code with their phone
								to approve your practical task.
							</p>
							<div className="bg-white p-4 rounded-xl shadow-sm">
								<QRCodeSVG value={approvalUrl} size={200} />
							</div>
							<div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
								<QrCode className="h-3.5 w-3.5" />
								Waiting for trainer approval...
							</div>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
