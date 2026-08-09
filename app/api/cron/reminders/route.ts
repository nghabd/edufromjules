import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCourseReminderEmail } from "@/lib/mail";
import { addDays, startOfDay, endOfDay } from "date-fns";

// This route should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// Protect with a secret token to prevent unauthorized calls
export async function GET(req: Request) {
	const authHeader = req.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;

	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	const now = new Date();
	const reminderDays = [7, 3, 1]; // Send reminders 7, 3, and 1 day before due
	let sent = 0;
	let errors = 0;

	for (const daysLeft of reminderDays) {
		const targetDate = addDays(now, daysLeft);
		const start = startOfDay(targetDate);
		const end = endOfDay(targetDate);

		const dueAssignments = await prisma.courseAssignment.findMany({
			where: {
				dueDate: { gte: start, lte: end },
				status: { not: "COMPLETED" },
			},
			include: {
				pharmacist: { select: { email: true, name: true } },
				course: { select: { title: true } },
			},
		});

		for (const assignment of dueAssignments) {
			try {
				await sendCourseReminderEmail({
					to: assignment.pharmacist.email,
					name: assignment.pharmacist.name,
					courseTitle: assignment.course.title,
					dueDate: assignment.dueDate!,
					daysLeft,
				});

				// Also create an in-app notification
				await prisma.notification.create({
					data: {
						userId: assignment.pharmacistId,
						title:
							daysLeft <= 1
								? "⚠️ Course due today!"
								: `Course due in ${daysLeft} days`,
						message: `"${assignment.course.title}" is due ${daysLeft <= 1 ? "today" : `in ${daysLeft} days`}. Complete it on time.`,
						type: daysLeft <= 1 ? "WARNING" : "INFO",
					},
				});

				sent++;
			} catch {
				errors++;
			}
		}
	}

	// Also notify for overdue assignments (just in-app, no email spam)
	const overdueAssignments = await prisma.courseAssignment.findMany({
		where: {
			dueDate: { lt: startOfDay(now) },
			status: { not: "COMPLETED" },
		},
		select: { pharmacistId: true, courseId: true, course: { select: { title: true } } },
	});

	// Create overdue notifications if not already created recently
	for (const a of overdueAssignments) {
		const recentOverdueNote = await prisma.notification.findFirst({
			where: {
				userId: a.pharmacistId,
				title: { contains: "overdue" },
				createdAt: { gte: addDays(now, -1) },
			},
		});
		if (!recentOverdueNote) {
			await prisma.notification.create({
				data: {
					userId: a.pharmacistId,
					title: "Course overdue",
					message: `"${a.course.title}" is overdue. Please complete it as soon as possible.`,
					type: "ERROR",
				},
			}).catch(() => null);
		}
	}

	return NextResponse.json({ sent, errors, overdueProcessed: overdueAssignments.length });
}
