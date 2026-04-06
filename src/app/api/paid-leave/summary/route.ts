import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Paid leave grant table: months of service → days granted
const PAID_LEAVE_TABLE = [
  { months: 6, days: 10 },
  { months: 18, days: 11 },
  { months: 30, days: 12 },
  { months: 42, days: 14 },
  { months: 54, days: 16 },
  { months: 66, days: 18 },
  { months: 78, days: 20 },
];

function getEntitlementDays(monthsOfService: number): number {
  let days = 0;
  for (const entry of PAID_LEAVE_TABLE) {
    if (monthsOfService >= entry.months) {
      days = entry.days;
    }
  }
  return days;
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const targetUserId =
    user.role === "ADMIN" && userId ? userId : user.id;

  const contract = await prisma.paidLeaveContract.findUnique({
    where: { userId: targetUserId },
  });

  if (!contract) {
    return NextResponse.json({ summary: null, message: "契約情報が未登録です" });
  }

  const grants = await prisma.paidLeaveGrant.findMany({
    where: { userId: targetUserId },
  });

  const usages = await prisma.paidLeaveUsage.findMany({
    where: { userId: targetUserId },
  });

  const today = new Date();
  const monthsOfService = monthsBetween(contract.joinDate, today);
  const entitlementDays = getEntitlementDays(monthsOfService);

  const totalGranted = grants.reduce((sum, g) => sum + g.days, 0);
  const totalUsedHours = usages.reduce((sum, u) => sum + u.hours, 0);
  const totalUsedDays = totalUsedHours / contract.avgDailyHours;
  const balance = totalGranted - totalUsedDays;

  // Calculate monthly attendance rates using Availability and ShiftAssignment
  let monthlyStats: Array<{
    yearMonth: string;
    availableDays: number;
    assignedDays: number;
    unscheduledDays: number;
    attendanceRate: number;
  }> = [];

  try {
    // Get all AVAILABLE availabilities for this user since 2023-01
    const availabilities = await prisma.availability.findMany({
      where: {
        staffUserId: targetUserId,
        status: "AVAILABLE",
        date: { gte: new Date("2023-01-01") },
      },
      orderBy: { date: "asc" },
    });

    // Get all shift assignments for this user
    const assignments = await prisma.shiftAssignment.findMany({
      where: { staffUserId: targetUserId },
    });

    const assignmentDates = new Set(
      assignments.map((a) => {
        const d = new Date(a.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })
    );

    // Group by year-month
    const monthMap = new Map<
      string,
      { available: number; assigned: number; unscheduled: number }
    >();

    for (const avail of availabilities) {
      const d = new Date(avail.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      if (!monthMap.has(ym)) {
        monthMap.set(ym, { available: 0, assigned: 0, unscheduled: 0 });
      }
      const entry = monthMap.get(ym)!;
      entry.available++;

      if (assignmentDates.has(dateStr)) {
        entry.assigned++;
      } else {
        // Check if this was a long available slot (>= 240 min)
        const startMin = avail.startMin ?? 0;
        const endMin = avail.endMin ?? 0;
        if (endMin - startMin >= 240) {
          entry.unscheduled++;
        }
      }
    }

    const contractedDaysPerMonth = contract.contractDaysPerWeek * 4.33;

    for (const [ym, stats] of Array.from(monthMap.entries())) {
      const workedAndAvailable = stats.assigned + stats.unscheduled;
      const attendanceRate = Math.min(
        1,
        workedAndAvailable / contractedDaysPerMonth
      );
      monthlyStats.push({
        yearMonth: ym,
        availableDays: stats.available,
        assignedDays: stats.assigned,
        unscheduledDays: stats.unscheduled,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      });
    }

    monthlyStats.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  } catch (e) {
    console.log("Could not load shift data:", e);
  }

  // Calculate next grant date and days
  const nextGrantMonths = PAID_LEAVE_TABLE.find(
    (t) => t.months > monthsOfService
  );
  const nextGrantDate = nextGrantMonths
    ? new Date(
        contract.joinDate.getFullYear(),
        contract.joinDate.getMonth() + nextGrantMonths.months,
        contract.joinDate.getDate()
      )
    : null;

  return NextResponse.json({
    summary: {
      userId: targetUserId,
      monthsOfService,
      entitlementDays,
      totalGranted,
      totalUsedHours,
      totalUsedDays,
      balance,
      monthlyStats,
      nextGrantDate,
      nextGrantDays: nextGrantMonths?.days ?? null,
      contract,
    },
  });
}
