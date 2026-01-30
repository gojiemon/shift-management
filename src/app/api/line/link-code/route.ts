import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateLinkCode, isLineConfigured } from "@/lib/line";

const LINK_CODE_EXPIRY_MINUTES = 15;

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!isLineConfigured()) {
      return NextResponse.json(
        { error: "LINE連携は設定されていません" },
        { status: 400 }
      );
    }

    // Check if already linked
    const existingLink = await prisma.lineLink.findUnique({
      where: { staffUserId: user.id },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "既にLINE連携されています" },
        { status: 400 }
      );
    }

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateLinkCode();
      const existing = await prisma.lineLinkCode.findUnique({
        where: { code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "コードの生成に失敗しました" },
        { status: 500 }
      );
    }

    const expiresAt = new Date(Date.now() + LINK_CODE_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing codes for this user
    await prisma.lineLinkCode.deleteMany({
      where: { staffUserId: user.id },
    });

    // Create new code
    const linkCode = await prisma.lineLinkCode.create({
      data: {
        staffUserId: user.id,
        code,
        expiresAt,
      },
    });

    return NextResponse.json({
      code: linkCode.code,
      expiresAt: linkCode.expiresAt,
    });
  } catch (error) {
    console.error("Failed to generate link code:", error);
    return NextResponse.json(
      { error: "コードの生成に失敗しました" },
      { status: 500 }
    );
  }
}
