import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await prisma.paidLeaveUsage.findUnique({
    where: { id: params.id },
  });

  if (!usage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin can delete any, staff can only delete their own
  if (user.role !== "ADMIN" && usage.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.paidLeaveUsage.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
