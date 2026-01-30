import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST: Initial setup - create admin user if none exists
export async function POST(request: NextRequest) {
  try {
    // Check if any admin user exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: "セットアップは既に完了しています" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { adminPassword } = body;

    if (!adminPassword || adminPassword.length < 6) {
      return NextResponse.json(
        { error: "管理者パスワードは6文字以上必要です" },
        { status: 400 }
      );
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        name: "管理者",
        role: "ADMIN",
        loginId: "admin",
        passwordHash,
      },
    });

    return NextResponse.json({
      success: true,
      message: "セットアップ完了",
      loginId: admin.loginId,
    });
  } catch (error) {
    console.error("Setup failed:", error);
    return NextResponse.json(
      { error: "セットアップに失敗しました" },
      { status: 500 }
    );
  }
}

// GET: Check if setup is needed
export async function GET() {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    return NextResponse.json({
      setupRequired: !existingAdmin,
    });
  } catch (error) {
    console.error("Setup check failed:", error);
    return NextResponse.json(
      { error: "確認に失敗しました" },
      { status: 500 }
    );
  }
}
