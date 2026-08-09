import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";

type RouteContext = {
  params: Promise<{ courseId: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  const originError = enforceTrustedOrigin(_req);
  if (originError) return originError;

  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const { courseId } = await context.params;
  await prisma.course.delete({ where: { id: courseId } });
  await publishDashboardRefresh([
    REALTIME_EVENTS.adminChanged,
    REALTIME_EVENTS.supervisorChanged,
    REALTIME_EVENTS.pharmacistChanged,
    REALTIME_EVENTS.courseChanged,
  ]);
  return Response.json({ ok: true });
}
