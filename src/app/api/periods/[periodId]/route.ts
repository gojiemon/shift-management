import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const updatePeriodSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  deadlineAt: z.string().nullable().optional(),
  isOpen: z.boolean().optional(),
  publishedAt: z.string().nullable().optional(),
});

// GET: Get single period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { periodId } = await params;

    const period = await prisma.shiftPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return NextResponse.json(
        { error: "期間が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ period });
  } catch (error) {
    console.error("Failed to fetch period:", error);
    return NextResponse.json(
      { error: "期間の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PATCH: Update period (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { periodId } = await params;
    const body = await request.json();
    const parsed = updatePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.startDate) {
      updateData.startDate = new Date(parsed.data.startDate);
    }
    if (parsed.data.endDate) {
      updateData.endDate = new Date(parsed.data.endDate);
    }
    if (parsed.data.deadlineAt !== undefined) {
      updateData.deadlineAt = parsed.data.deadlineAt
        ? new Date(parsed.data.deadlineAt)
        : null;
    }
    if (parsed.data.isOpen !== undefined) {
      updateData.isOpen = parsed.data.isOpen;
    }
    if (parsed.data.publishedAt !== undefined) {
      updateData.publishedAt = parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null;
    }

    const period = await prisma.shiftPeriod.update({
      where: { id: periodId },
      data: updateData,
    });

    return NextResponse.json({ period });
  } catch (error) {
    console.error("Failed to update period:", error);
    return NextResponse.json(
      { error: "期間の更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: Delete period (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { periodId } = await params;

    await prisma.shiftPeriod.delete({
      where: { id: periodId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete period:", error);
    return NextResponse.json(
      { error: "期間の削除に失敗しました" },
      { status: 500 }
    );
  }
}
