import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushMessage, isLineConfigured } from "@/lib/line";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { z } from "zod";

const notifySchema = z.object({
  type: z.enum(["reminder", "publish"]),
  periodId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    if (!isLineConfigured()) {
      return NextResponse.json(
        { error: "LINE連携は設定されていません" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = notifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { type, periodId } = parsed.data;

    const period = await prisma.shiftPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return NextResponse.json(
        { error: "期間が見つかりません" },
        { status: 404 }
      );
    }

    const periodLabel = `${format(period.startDate, "M/d", { locale: ja })}〜${format(period.endDate, "M/d", { locale: ja })}`;
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    let sentCount = 0;

    if (type === "reminder") {
      // Get staff who haven't submitted and have LINE linked
      const submissions = await prisma.submission.findMany({
        where: { periodId },
        select: { staffUserId: true },
      });
      const submittedIds = new Set(submissions.map((s) => s.staffUserId));

      const linkedStaff = await prisma.lineLink.findMany({
        include: { staff: true },
      });

      const deadlineLabel = period.deadlineAt
        ? format(period.deadlineAt, "M/d(E) HH:mm", { locale: ja })
        : "未設定";

      for (const link of linkedStaff) {
        if (submittedIds.has(link.staffUserId)) continue;

        const message = `【シフト希望】${periodLabel}の希望提出がまだです。\n期限：${deadlineLabel}\nアプリから入力お願いします。\n${baseUrl}/staff/periods/${periodId}/availability`;

        const success = await sendPushMessage(link.lineUserId, message);
        if (success) sentCount++;
      }
    } else if (type === "publish") {
      // Get all staff with LINE linked
      const linkedStaff = await prisma.lineLink.findMany();

      for (const link of linkedStaff) {
        const message = `【シフト確定】${periodLabel}のシフトを公開しました。\nアプリで確認できます：\n${baseUrl}/staff/schedule/${periodId}`;

        const success = await sendPushMessage(link.lineUserId, message);
        if (success) sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return NextResponse.json(
      { error: "通知の送信に失敗しました" },
      { status: 500 }
    );
  }
}
