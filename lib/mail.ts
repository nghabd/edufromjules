type EmailMessage = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

type AssignmentEmail = {
	to: string;
	courseTitle: string;
	pharmacistName?: string | null;
	dueDate?: Date | null;
};

export type NotificationEmail = {
	to: string;
	name?: string | null;
	title: string;
	message: string;
};

type PasswordResetEmail = {
	to: string;
	name?: string | null;
	resetUrl: string;
	expiresMinutes: number;
};

type SendEmailOptions = {
	allowMissingProvider?: boolean;
};

type SendGridConfig = {
	apiKey: string;
	fromEmail: string;
	fromName: string;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function getSendGridConfig(): SendGridConfig | null {
	const apiKey = process.env.SENDGRID_API_KEY?.trim();
	const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
	const fromName = process.env.SENDGRID_FROM_NAME?.trim() || "edustation";

	if (!apiKey && !fromEmail) {
		return null;
	}

	if (!apiKey || !fromEmail) {
		throw new Error(
			"SendGrid requires both SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.",
		);
	}

	return {
		apiKey,
		fromEmail,
		fromName,
	};
}

async function sendWithSendGrid(message: EmailMessage, config: SendGridConfig) {
	const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			personalizations: [
				{
					to: [{ email: message.to }],
				},
			],
			from: {
				email: config.fromEmail,
				name: config.fromName,
			},
			subject: message.subject,
			content: [
				{
					type: "text/plain",
					value: message.text,
				},
				{
					type: "text/html",
					value: message.html,
				},
			],
		}),
	});

	if (!response.ok) {
		const details = await response.text().catch(() => "");
		if (details.includes("verified Sender Identity")) {
			throw new Error(
				`SendGrid sender is not verified. Verify SENDGRID_FROM_EMAIL (${config.fromEmail}) in SendGrid Sender Authentication, or change it to an already verified sender.`,
			);
		}
		throw new Error(
			`SendGrid send failed with status ${response.status}: ${details.slice(0, 500)}`,
		);
	}

	console.info("[SENDGRID_ACCEPTED]", {
		messageId: response.headers.get("x-message-id"),
		fromDomain: config.fromEmail.split("@").pop(),
		toDomain: message.to.split("@").pop(),
	});
}

async function sendWithWebhook(message: EmailMessage) {
	const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
	const apiKey = process.env.EMAIL_API_KEY;

	if (!webhookUrl) {
		return false;
	}

	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
		},
		body: JSON.stringify(message),
	});

	if (!response.ok) {
		const details = await response.text().catch(() => "");
		throw new Error(
			`Email webhook failed with status ${response.status}: ${details.slice(0, 500)}`,
		);
	}

	return true;
}

export async function sendEmail(
	message: EmailMessage,
	options: SendEmailOptions = {},
) {
	const sendGridConfig = getSendGridConfig();

	if (sendGridConfig) {
		await sendWithSendGrid(message, sendGridConfig);
		return;
	}

	const sentWithWebhook = await sendWithWebhook(message);
	if (sentWithWebhook) {
		return;
	}

	if (options.allowMissingProvider) {
		console.info("[MAIL_SKIPPED] No email provider is configured.");
		return;
	}

	throw new Error(
		"No email provider is configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.",
	);
}

export async function sendAssignmentEmail({
	to,
	pharmacistName,
	courseTitle,
	dueDate,
}: AssignmentEmail) {
	const name = pharmacistName;
	const safeName = escapeHtml(name ?? "there");
	const safeCourseTitle = escapeHtml(courseTitle);
	const dueText = dueDate
		? ` It is due on ${dueDate.toLocaleDateString()}.`
		: "";

	try {
		await sendEmail(
			{
				to,
				subject: `New edustation course assigned: ${courseTitle}`,
				text: `Hello ${name ?? "there"},\n\nYou have been assigned "${courseTitle}".${dueText}\n\nSign in to edustation to start learning.`,
				html: `
					<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
						<h2 style="margin:0 0 12px">New course assigned</h2>
						<p>Hello ${safeName},</p>
						<p>You have been assigned <strong>${safeCourseTitle}</strong>.${escapeHtml(dueText)}</p>
						<p>Sign in to edustation to start learning.</p>
					</div>
				`,
			},
			{ allowMissingProvider: true },
		);
	} catch (error) {
		console.error("[MAIL_FAILED]", error);
	}
}

export async function sendPasswordResetEmail({
	to,
	name,
	resetUrl,
	expiresMinutes,
}: PasswordResetEmail) {
	const safeName = escapeHtml(name ?? "there");
	const safeResetUrl = escapeHtml(resetUrl);

	await sendEmail({
		to,
		subject: "Reset your edustation password",
		text: `Hello ${name ?? "there"},\n\nUse this link to reset your edustation password:\n${resetUrl}\n\nThis link expires in ${expiresMinutes} minutes. If you did not request a password reset, you can ignore this email.`,
		html: `
			<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
				<h2 style="margin:0 0 12px">Reset your password</h2>
				<p>Hello ${safeName},</p>
				<p>Use the button below to reset your edustation password. This link expires in ${expiresMinutes} minutes.</p>
				<p style="margin:24px 0">
					<a href="${safeResetUrl}" style="background:#2563eb;color:#ffffff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:700">Reset password</a>
				</p>
				<p>If the button does not work, copy and paste this link into your browser:</p>
				<p style="word-break:break-all"><a href="${safeResetUrl}">${safeResetUrl}</a></p>
				<p>If you did not request a password reset, you can ignore this email.</p>
			</div>
		`,
	});
}

export async function sendCourseReminderEmail({
	to,
	name,
	courseTitle,
	dueDate,
	daysLeft,
}: {
	to: string;
	name?: string | null;
	courseTitle: string;
	dueDate: Date;
	daysLeft: number;
}) {
	const safeName = escapeHtml(name ?? "there");
	const safeCourseTitle = escapeHtml(courseTitle);
	const dueDateStr = dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
	const urgency = daysLeft <= 1 ? "URGENT: " : daysLeft <= 3 ? "Reminder: " : "";
	const urgencyColor = daysLeft <= 1 ? "#dc2626" : daysLeft <= 3 ? "#d97706" : "#2563eb";
	try {
		await sendEmail(
			{
				to,
				subject: `${urgency}Course due ${daysLeft <= 0 ? "today" : `in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}: ${courseTitle}`,
				text: `Hello ${name ?? "there"},\n\nThis is a reminder that "${courseTitle}" is due on ${dueDateStr}.\n\nSign in to edustation to continue.`,
				html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2 style="color:${urgencyColor}">${urgency}Course Reminder</h2><p>Hello ${safeName},</p><p><strong>${safeCourseTitle}</strong> is due on <strong>${escapeHtml(dueDateStr)}</strong>.</p><p style="color:${urgencyColor};font-weight:600">${daysLeft <= 0 ? "Due today!" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}</p></div>`,
			},
			{ allowMissingProvider: true },
		);
	} catch (error) {
		console.error("[MAIL_REMINDER_FAILED]", error);
	}
}

export async function sendCertificateEmail({
	to,
	name,
	courseTitle,
	issueDate,
}: {
	to: string;
	name?: string | null;
	courseTitle: string;
	issueDate: Date;
}) {
	const safeName = escapeHtml(name ?? "there");
	const safeCourseTitle = escapeHtml(courseTitle);
	const issueDateStr = issueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
	try {
		await sendEmail(
			{
				to,
				subject: `Certificate earned: ${courseTitle}`,
				text: `Congratulations ${name ?? "there"}! You completed "${courseTitle}" on ${issueDateStr}. Sign in to edustation to view your certificate.`,
				html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2 style="color:#16a34a">🎉 Certificate Earned!</h2><p>Congratulations ${safeName}!</p><p>You completed <strong>${safeCourseTitle}</strong> on <strong>${escapeHtml(issueDateStr)}</strong>.</p><p>Sign in to edustation to view and download your certificate.</p></div>`,
			},
			{ allowMissingProvider: true },
		);
	} catch (error) {
		console.error("[MAIL_CERT_FAILED]", error);
	}
}


export async function sendNotificationEmail({
	to,
	name,
	title,
	message,
}: NotificationEmail) {
	const safeName = escapeHtml(name ?? "there");
	const safeTitle = escapeHtml(title);
	const safeMessage = escapeHtml(message);

	try {
		await sendEmail(
			{
				to,
				subject: title,
				text: `Hello ${name ?? "there"},\n\n${message}\n\nOpen edustation to view the update.`,
				html: `
					<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
						<h2 style="margin:0 0 12px">${safeTitle}</h2>
						<p>Hello ${safeName},</p>
						<p>${safeMessage}</p>
						<p>Open edustation to view the update.</p>
					</div>
				`,
			},
			{ allowMissingProvider: true },
		);
	} catch (error) {
		console.error("[MAIL_FAILED]", error);
	}
}

