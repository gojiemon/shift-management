import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isLineConfigured } from "@/lib/line";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const lineEnabled = isLineConfigured();

    if (!lineEnabled) {
      return NextResponse.json({ lineEnabled: false, isLinked: false });
    }

    const lineLink = await prisma.lineLink.findUnique({
      where: { staffUserId: user.id },
    });

    return NextResponse.json({
      lineEnabled: true,
      isLinked: !!lineLink,
      linkedAt: lineLink?.linkedAt,
    });
  } catch (error) {
    console.error("Failed to get link status:", error);
    return NextResponse.json(
      { error: "連携状況の取得に失敗しました" },
      { status: 500 }
    );
  }
}
