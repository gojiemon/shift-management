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

  // Admin can query any user, staff can only query themselves
  const targetUserId =
    user.role === "ADMIN" && userId ? userId : user.id;

  const contract = await prisma.paidLeaveContract.findUnique({
    where: { userId: targetUserId },
  });

  return NextResponse.json({ contract });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    userId,
    joinDate,
    contractDaysPerWeek,
    requiresWeekend,
    weekendDays,
    avgDailyHours,
    notes,
  } = body;

  // Admin can set for any user, staff can only set for themselves
  const targetUserId =
    user.role === "ADMIN" && userId ? userId : user.id;

  const contract = await prisma.paidLeaveContract.upsert({
    where: { userId: targetUserId },
    update: {
      joinDate: new Date(joinDate),
      contractDaysPerWeek,
      requiresWeekend: requiresWeekend ?? false,
      weekendDays: weekendDays ?? "",
      avgDailyHours: avgDailyHours ?? 7.0,
      notes: notes ?? "",
    },
    create: {
      userId: targetUserId,
      joinDate: new Date(joinDate),
      contractDaysPerWeek,
      requiresWeekend: requiresWeekend ?? false,
      weekendDays: weekendDays ?? "",
      avgDailyHours: avgDailyHours ?? 7.0,
      notes: notes ?? "",
    },
  });

  return NextResponse.json({ contract });
}
