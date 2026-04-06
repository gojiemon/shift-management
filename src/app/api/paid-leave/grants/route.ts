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

  const grants = await prisma.paidLeaveGrant.findMany({
    where: { userId: targetUserId },
    orderBy: { grantDate: "desc" },
  });

  return NextResponse.json({ grants });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, grantDate, days, reason, expiryDate } = body;

  if (!userId || !grantDate || days === undefined || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const grant = await prisma.paidLeaveGrant.create({
    data: {
      userId,
      grantDate: new Date(grantDate),
      days,
      reason,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    },
  });

  return NextResponse.json({ grant });
}
