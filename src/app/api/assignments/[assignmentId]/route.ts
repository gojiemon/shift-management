import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { BUSINESS_START_MIN, BUSINESS_END_MIN, TIME_SLOT_INTERVAL } from "@/lib/constants";

const VALID_BREAK_MINS = [30, 45, 60];

const updateAssignmentSchema = z.object({
  startMin: z.number().optional(),
  endMin: z.number().optional(),
  breakMin: z.number().nullable().optional(),
  breakStartMin: z.number().nullable().optional(),
  note: z.string().optional(),
});

// PATCH: Update assignment (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { assignmentId } = params;
    const body = await request.json();
    const parsed = updateAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const existing = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "シフトが見つかりません" },
        { status: 404 }
      );
    }

    const startMin = parsed.data.startMin ?? existing.startMin;
    const endMin = parsed.data.endMin ?? existing.endMin;

    // Validate time range
    if (startMin < BUSINESS_START_MIN || endMin > BUSINESS_END_MIN) {
      return NextResponse.json(
        { error: "営業時間外は設定できません（10:00〜20:30）" },
        { status: 400 }
      );
    }

    if (startMin >= endMin) {
      return NextResponse.json(
        { error: "終了時間は開始時間より後にしてください" },
        { status: 400 }
      );
    }

    // 15分刻みでチェック
    if (startMin % 15 !== 0 || endMin % 15 !== 0) {
      return NextResponse.json(
        { error: "時間は15分刻みで指定してください" },
        { status: 400 }
      );
    }

    // 休憩時間のバリデーション
    const breakMin = parsed.data.breakMin !== undefined
      ? parsed.data.breakMin
      : existing.breakMin;

    const shiftDuration = endMin - startMin;

    if (breakMin !== null && breakMin !== undefined) {
      if (!VALID_BREAK_MINS.includes(breakMin)) {
        return NextResponse.json(
          { error: "休憩は30分、45分、1時間のいずれかで指定してください" },
          { status: 400 }
        );
      }
      if (breakMin >= shiftDuration) {
        return NextResponse.json(
          { error: "休憩時間がシフト時間を超えています" },
          { status: 400 }
        );
      }
    }

    // 休憩開始位置のバリデーション
    let breakStartMin = parsed.data.breakStartMin !== undefined
      ? parsed.data.breakStartMin
      : existing.breakStartMin;

    // 休憩がある場合、開始位置をバリデート
    if (breakMin !== null && breakMin !== undefined) {
      // デフォルトは真ん中あたりに配置
      if (breakStartMin === null || breakStartMin === undefined) {
        breakStartMin = startMin + Math.floor((shiftDuration - breakMin) / 2 / 15) * 15;
      }
      // 休憩開始位置がシフト範囲内かチェック
      if (breakStartMin < startMin || breakStartMin + breakMin > endMin) {
        // 範囲外なら調整
        breakStartMin = Math.max(startMin, Math.min(endMin - breakMin, breakStartMin));
      }
    } else {
      breakStartMin = null;
    }

    const assignment = await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        startMin,
        endMin,
        breakMin: parsed.data.breakMin !== undefined ? parsed.data.breakMin : undefined,
        breakStartMin: breakStartMin,
        note: parsed.data.note,
      },
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Failed to update assignment:", error);
    return NextResponse.json(
      { error: "シフトの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: Delete assignment (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { assignmentId } = params;

    await prisma.shiftAssignment.delete({
      where: { id: assignmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete assignment:", error);
    return NextResponse.json(
      { error: "シフトの削除に失敗しました" },
      { status: 500 }
    );
  }
}
