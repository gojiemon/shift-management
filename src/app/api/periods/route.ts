import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { startOfDay, endOfDay, lastDayOfMonth } from "date-fns";

const createPeriodSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  deadlineAt: z.string().optional(),
});

// GET: List periods
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeSubmissions = searchParams.get("includeSubmissions") === "true";

    const periods = await prisma.shiftPeriod.findMany({
      orderBy: { startDate: "desc" },
      include: includeSubmissions
        ? {
            submissions: {
              select: { staffUserId: true, submittedAt: true },
            },
          }
        : undefined,
    });

    return NextResponse.json({ periods });
  } catch (error) {
    console.error("Failed to fetch periods:", error);
    return NextResponse.json(
      { error: "期間の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Create period (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const startDate = startOfDay(new Date(parsed.data.startDate));
    const endDate = endOfDay(new Date(parsed.data.endDate));
    const deadlineAt = parsed.data.deadlineAt
      ? new Date(parsed.data.deadlineAt)
      : null;

    const period = await prisma.shiftPeriod.create({
      data: {
        startDate,
        endDate,
        deadlineAt,
      },
    });

    return NextResponse.json({ period }, { status: 201 });
  } catch (error) {
    console.error("Failed to create period:", error);
    return NextResponse.json(
      { error: "期間の作成に失敗しました" },
      { status: 500 }
    );
  }
}
