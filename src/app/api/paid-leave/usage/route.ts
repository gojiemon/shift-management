import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const targetUserId =
    user.role === "ADMIN" && userId ? userId : user.id;

  const usages = await prisma.paidLeaveUsage.findMany({
    where: { userId: targetUserId },
    orderBy: { usageDate: "desc" },
  });

  return NextResponse.json({ usages });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, usageDate, hours, note } = body;

  const targetUserId =
    user.role === "ADMIN" && userId ? userId : user.id;

  const usage = await prisma.paidLeaveUsage.create({
    data: {
      userId: targetUserId,
      usageDate: new Date(usageDate),
      hours,
      note: note ?? "",
    },
  });

  return NextResponse.json({ usage });
}
