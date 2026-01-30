import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const submissionSchema = z.object({
  periodId: z.string(),
});

// GET: Get submission status
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");

    if (!periodId) {
      return NextResponse.json(
        { error: "periodIdは必須です" },
        { status: 400 }
      );
    }

    // Admin can see all submissions
    if (user.role === "ADMIN") {
      const submissions = await prisma.submission.findMany({
        where: { periodId },
        include: {
          staff: {
            select: { id: true, name: true },
          },
        },
      });

      // Get all staff for comparison
      const allStaff = await prisma.user.findMany({
        where: { role: "STAFF" },
        select: { id: true, name: true },
      });

      const submittedIds = new Set(submissions.map((s) => s.staffUserId));
      const notSubmitted = allStaff.filter((s) => !submittedIds.has(s.id));

      return NextResponse.json({
        submissions,
        submitted: submissions.map((s) => s.staff),
        notSubmitted,
      });
    }

    // Staff can only see their own submission
    const submission = await prisma.submission.findUnique({
      where: {
        periodId_staffUserId: {
          periodId,
          staffUserId: user.id,
        },
      },
    });

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Failed to fetch submission:", error);
    return NextResponse.json(
      { error: "提出状況の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Submit availability
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = submissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Check period exists and is open
    const period = await prisma.shiftPeriod.findUnique({
      where: { id: parsed.data.periodId },
    });

    if (!period) {
      return NextResponse.json(
        { error: "期間が見つかりません" },
        { status: 404 }
      );
    }

    if (!period.isOpen) {
      return NextResponse.json(
        { error: "この期間は受付を終了しています" },
        { status: 400 }
      );
    }

    // Create or update submission
    const submission = await prisma.submission.upsert({
      where: {
        periodId_staffUserId: {
          periodId: parsed.data.periodId,
          staffUserId: user.id,
        },
      },
      update: {
        submittedAt: new Date(),
      },
      create: {
        periodId: parsed.data.periodId,
        staffUserId: user.id,
      },
    });

    // Revalidate the periods page to show updated submission status
    revalidatePath("/staff/periods");

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Failed to submit:", error);
    return NextResponse.json(
      { error: "提出に失敗しました" },
      { status: 500 }
    );
  }
}
