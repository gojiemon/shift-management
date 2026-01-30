import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { z } from "zod";

const createStaffSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  loginId: z.string().min(3, "ログインIDは3文字以上必要です"),
  password: z.string().min(6, "パスワードは6文字以上必要です"),
});

// GET: List all staff members (Admin only)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const staff = await prisma.user.findMany({
      where: { role: "STAFF" },
      select: {
        id: true,
        name: true,
        loginId: true,
        createdAt: true,
        lineLink: {
          select: { linkedAt: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Failed to fetch staff:", error);
    return NextResponse.json(
      { error: "スタッフの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Create new staff member (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Check if loginId already exists
    const existing = await prisma.user.findUnique({
      where: { loginId: parsed.data.loginId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "このログインIDは既に使用されています" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const newStaff = await prisma.user.create({
      data: {
        name: parsed.data.name,
        loginId: parsed.data.loginId,
        passwordHash,
        role: "STAFF",
      },
      select: {
        id: true,
        name: true,
        loginId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ staff: newStaff }, { status: 201 });
  } catch (error) {
    console.error("Failed to create staff:", error);
    return NextResponse.json(
      { error: "スタッフの作成に失敗しました" },
      { status: 500 }
    );
  }
}
