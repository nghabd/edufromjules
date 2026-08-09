export const REALTIME_CHANNEL = "pharma-lms-dashboard";

export const REALTIME_EVENTS = {
	adminChanged: "admin:changed",
	supervisorChanged: "supervisor:changed",
	pharmacistChanged: "pharmacist:changed",
	courseChanged: "course:changed",
	assignmentChanged: "assignment:changed",
	progressChanged: "progress:changed",
	practicalApproved: "practical:approved",
	notificationCreated: "notification:created",
	certificateIssued: "certificate:issued",
	analyticsChanged: "analytics:changed",
	messageCreated: "message:created",
} as const;

export type RealtimeEvent =
	(typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
