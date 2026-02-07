import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET: スタッフ用 期間一覧（提出状況付き）
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const periods = await prisma.shiftPeriod.findMany({
      orderBy: { startDate: "desc" },
      include: {
        submissions: {
          where: { staffUserId: user.id },
          select: { submittedAt: true },
        },
      },
    });

    return NextResponse.json({ periods });
  } catch (error) {
    console.error("Failed to fetch staff periods:", error);
    return NextResponse.json(
      { error: "期間の取得に失敗しました" },
      { status: 500 }
    );
  }
}
