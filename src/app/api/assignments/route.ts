import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { BUSINESS_START_MIN, BUSINESS_END_MIN, TIME_SLOT_INTERVAL } from "@/lib/constants";

const VALID_BREAK_MINS = [30, 45, 60];

const assignmentSchema = z.object({
  periodId: z.string(),
  staffUserId: z.string(),
  date: z.string(),
  startMin: z.number(),
  endMin: z.number(),
  breakMin: z.number().nullable().optional(),
  breakStartMin: z.number().nullable().optional(),
  note: z.string().optional(),
});

// GET: Get shift assignments
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

    const where: Record<string, unknown> = { periodId };

    // Staff can only see published assignments (and only their own)
    if (user.role === "STAFF") {
      const period = await prisma.shiftPeriod.findUnique({
        where: { id: periodId },
      });

      if (!period?.publishedAt) {
        return NextResponse.json({ assignments: [] });
      }

      where.staffUserId = user.id;
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    return NextResponse.json(
      { error: "シフトの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Create assignment (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = assignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Validate time range
    if (parsed.data.startMin < BUSINESS_START_MIN || parsed.data.endMin > BUSINESS_END_MIN) {
      return NextResponse.json(
        { error: "営業時間外は設定できません（10:00〜20:30）" },
        { status: 400 }
      );
    }

    if (parsed.data.startMin >= parsed.data.endMin) {
      return NextResponse.json(
        { error: "終了時間は開始時間より後にしてください" },
        { status: 400 }
      );
    }

    // 15分刻みでチェック
    if (parsed.data.startMin % 15 !== 0 || parsed.data.endMin % 15 !== 0) {
      return NextResponse.json(
        { error: "時間は15分刻みで指定してください" },
        { status: 400 }
      );
    }

    // 休憩時間のバリデーション（30, 45, 60分のみ許可）
    if (parsed.data.breakMin !== null && parsed.data.breakMin !== undefined) {
      if (!VALID_BREAK_MINS.includes(parsed.data.breakMin)) {
        return NextResponse.json(
          { error: "休憩は30分、45分、1時間のいずれかで指定してください" },
          { status: 400 }
        );
      }
      // 休憩がシフト時間を超えないかチェック
      const shiftDuration = parsed.data.endMin - parsed.data.startMin;
      if (parsed.data.breakMin >= shiftDuration) {
        return NextResponse.json(
          { error: "休憩時間がシフト時間を超えています" },
          { status: 400 }
        );
      }
    }

    const date = new Date(parsed.data.date);

    // Check for duplicate assignment
    const existing = await prisma.shiftAssignment.findUnique({
      where: {
        periodId_staffUserId_date: {
          periodId: parsed.data.periodId,
          staffUserId: parsed.data.staffUserId,
          date,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "同一スタッフ・同一日に複数のシフトは登録できません" },
        { status: 400 }
      );
    }

    // 休憩開始位置を計算（デフォルトは真ん中あたり）
    let breakStartMin: number | null = null;
    if (parsed.data.breakMin) {
      const shiftDuration = parsed.data.endMin - parsed.data.startMin;
      breakStartMin = parsed.data.breakStartMin ??
        (parsed.data.startMin + Math.floor((shiftDuration - parsed.data.breakMin) / 2 / 15) * 15);
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        periodId: parsed.data.periodId,
        staffUserId: parsed.data.staffUserId,
        date,
        startMin: parsed.data.startMin,
        endMin: parsed.data.endMin,
        breakMin: parsed.data.breakMin ?? null,
        breakStartMin,
        note: parsed.data.note,
      },
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create assignment:", error);
    return NextResponse.json(
      { error: "シフトの作成に失敗しました" },
      { status: 500 }
    );
  }
}
