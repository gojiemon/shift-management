import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { z } from "zod";

const updateStaffSchema = z.object({
  name: z.string().min(1, "名前は必須です").optional(),
  password: z.string().min(6, "パスワードは6文字以上必要です").optional(),
});

// GET: Get single staff member (Admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { staffId } = await params;

    const staff = await prisma.user.findUnique({
      where: { id: staffId, role: "STAFF" },
      select: {
        id: true,
        name: true,
        loginId: true,
        createdAt: true,
        lineLink: {
          select: { linkedAt: true },
        },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "スタッフが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Failed to fetch staff:", error);
    return NextResponse.json(
      { error: "スタッフの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PATCH: Update staff member (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { staffId } = await params;
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: staffId, role: "STAFF" },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "スタッフが見つかりません" },
        { status: 404 }
      );
    }

    const updateData: { name?: string; passwordHash?: string } = {};

    if (parsed.data.name) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.password) {
      updateData.passwordHash = await hashPassword(parsed.data.password);
    }

    const staff = await prisma.user.update({
      where: { id: staffId },
      data: updateData,
      select: {
        id: true,
        name: true,
        loginId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Failed to update staff:", error);
    return NextResponse.json(
      { error: "スタッフの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: Delete staff member (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const { staffId } = await params;

    const existing = await prisma.user.findUnique({
      where: { id: staffId, role: "STAFF" },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "スタッフが見つかりません" },
        { status: 404 }
      );
    }

    // Delete related data first (cascading)
    await prisma.$transaction([
      // Delete sessions
      prisma.session.deleteMany({ where: { userId: staffId } }),
      // Delete LINE link
      prisma.lineLink.deleteMany({ where: { staffUserId: staffId } }),
      // Delete LINE link codes
      prisma.lineLinkCode.deleteMany({ where: { staffUserId: staffId } }),
      // Delete availabilities
      prisma.availability.deleteMany({ where: { staffUserId: staffId } }),
      // Delete submissions
      prisma.submission.deleteMany({ where: { staffUserId: staffId } }),
      // Delete shift assignments
      prisma.shiftAssignment.deleteMany({ where: { staffUserId: staffId } }),
      // Finally delete the user
      prisma.user.delete({ where: { id: staffId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete staff:", error);
    return NextResponse.json(
      { error: "スタッフの削除に失敗しました" },
      { status: 500 }
    );
  }
}
