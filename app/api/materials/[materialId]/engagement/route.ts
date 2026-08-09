import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { findAccessibleMaterial } from "@/lib/material-access";
import { enforceTrustedOrigin } from "@/lib/request-security";
import { publishDashboardRefresh } from "@/lib/realtime-server";
import { REALTIME_EVENTS } from "@/lib/realtime-events";
import { getMaterialDeliveryUrl } from "@/lib/material-url";
import { issueCourseCertificateIfComplete } from "@/lib/certificates";

type RouteContext = {
  params: Promise<{ materialId: string }>;
};

const ONE_MINUTE = 60_000;
const TIMED_MEDIA_TYPES = new Set(["PDF", "VIDEO", "IMAGE"]);

function isTimedMediaMaterial(type: string) {
  return TIMED_MEDIA_TYPES.has(type);
}

async function publishProgressChanged() {
  await publishDashboardRefresh([
    REALTIME_EVENTS.supervisorChanged,
    REALTIME_EVENTS.pharmacistChanged,
    REALTIME_EVENTS.progressChanged,
  ]);
}

export async function GET(_req: Request, context: RouteContext) {
  const { error, session } = await requireRole(["ADMIN", "SUPERVISOR", "PHARMACIST"]);
  if (error) return error;

  const { materialId } = await context.params;
  const material = await findAccessibleMaterial(materialId, session.user.id, session.user.role);
  if (!material) return NextResponse.json({ message: "Material not found." }, { status: 404 });

  const now = new Date();
  const shouldStartTimedGate = isTimedMediaMaterial(material.type);
  const existingEngagement = await prisma.materialEngagement.findUnique({
    where: { userId_materialId: { userId: session.user.id, materialId } },
  });

  let engagement;
  if (shouldStartTimedGate) {
    engagement = existingEngagement
      ? await prisma.materialEngagement.update({
          where: { userId_materialId: { userId: session.user.id, materialId } },
          data: {
            lastOpenedAt: now,
            controlsUnlocked:
              existingEngagement.firstGateCompleted ||
              existingEngagement.controlsUnlocked ||
              Boolean(
                existingEngagement.closeAllowedAt &&
                  existingEngagement.closeAllowedAt <= now,
              ),
          },
        })
      : await prisma.materialEngagement.create({
          data: {
            userId: session.user.id,
            materialId,
            closeAllowedAt: new Date(now.getTime() + ONE_MINUTE),
          },
        });
  } else {
    engagement = await prisma.materialEngagement.upsert({
      where: { userId_materialId: { userId: session.user.id, materialId } },
      update: {
        firstGateCompleted: true,
        controlsUnlocked: true,
        lastOpenedAt: now,
        closeAllowedAt: now,
        promptPassedAt: now,
      },
      create: {
        userId: session.user.id,
        materialId,
        firstGateCompleted: true,
        controlsUnlocked: true,
        closeAllowedAt: now,
        promptPassedAt: now,
      },
    });

    if (session.user.role === "PHARMACIST") {
      await prisma.userProgress.upsert({
        where: { userId_materialId: { userId: session.user.id, materialId } },
        update: {
          completed: true,
          progress: 100,
          completionStatus: "APPROVED",
          lastAccessed: now,
        },
        create: {
          userId: session.user.id,
          materialId,
          completed: true,
          progress: 100,
          completionStatus: "APPROVED",
        },
      });
      await publishProgressChanged();
      await issueCourseCertificateIfComplete(
        session.user.id,
        material.topic.course.id,
      ).catch((error) => {
        console.error("[CERTIFICATE_ENGAGEMENT_BACKFILL_FAILED]", error);
      });
    }
  }

  return NextResponse.json({
    material: {
      id: material.id,
      type: material.type,
      title: material.title,
      url: getMaterialDeliveryUrl(material),
      gateQuestion: material.gateQuestion,
    },
    engagement,
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const originError = enforceTrustedOrigin(req);
  if (originError) return originError;

  const { error, session } = await requireRole(["PHARMACIST"]);
  if (error) return error;

  const { materialId } = await context.params;
  const material = await findAccessibleMaterial(materialId, session.user.id, session.user.role);
  if (!material) return NextResponse.json({ message: "Material not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  const answer = String(body?.answer ?? "").trim().toLowerCase();
  const expected = (material.gateAnswer ?? "learned").trim().toLowerCase();

  if (!isTimedMediaMaterial(material.type)) {
    const now = new Date();
    const engagement = await prisma.materialEngagement.upsert({
      where: { userId_materialId: { userId: session.user.id, materialId } },
      update: {
        firstGateCompleted: true,
        controlsUnlocked: true,
        lastOpenedAt: now,
        closeAllowedAt: now,
        promptPassedAt: now,
      },
      create: {
        userId: session.user.id,
        materialId,
        firstGateCompleted: true,
        controlsUnlocked: true,
        closeAllowedAt: now,
        promptPassedAt: now,
      },
    });

    await prisma.userProgress.upsert({
      where: { userId_materialId: { userId: session.user.id, materialId } },
      update: {
        completed: true,
        progress: 100,
        completionStatus: "APPROVED",
        lastAccessed: now,
      },
      create: {
        userId: session.user.id,
        materialId,
        completed: true,
        progress: 100,
        completionStatus: "APPROVED",
      },
    });
    await publishProgressChanged();

    return NextResponse.json({ correct: true, engagement });
  }

  if (action === "unlock") {
    const engagement = await prisma.materialEngagement.update({
      where: { userId_materialId: { userId: session.user.id, materialId } },
      data: { controlsUnlocked: true },
    });
    return NextResponse.json(engagement);
  }

  if (action === "prompt") {
    const correct = answer === expected;
    const engagement = await prisma.materialEngagement.update({
      where: { userId_materialId: { userId: session.user.id, materialId } },
      data: correct
        ? {
            firstGateCompleted: true,
            controlsUnlocked: true,
            promptPassedAt: new Date(),
          }
        : {
            firstGateCompleted: false,
            controlsUnlocked: true,
            promptPassedAt: null,
          },
    });

    if (correct) {
      await prisma.userProgress.upsert({
        where: { userId_materialId: { userId: session.user.id, materialId } },
        update: {
          completed: true,
          progress: 100,
          completionStatus: "APPROVED",
          lastAccessed: new Date(),
        },
        create: {
          userId: session.user.id,
          materialId,
          completed: true,
          progress: 100,
          completionStatus: "APPROVED",
        },
      });
      await publishDashboardRefresh([
        REALTIME_EVENTS.supervisorChanged,
        REALTIME_EVENTS.pharmacistChanged,
        REALTIME_EVENTS.progressChanged,
      ]);
      await issueCourseCertificateIfComplete(
        session.user.id,
        material.topic.course.id,
      ).catch((error) => {
        console.error("[CERTIFICATE_ENGAGEMENT_COMPLETE_FAILED]", error);
      });
    }

    return NextResponse.json({ correct, engagement });
  }

  return NextResponse.json({ message: "Invalid action." }, { status: 400 });
}
