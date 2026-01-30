import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { BUSINESS_START_MIN, BUSINESS_END_MIN, TIME_SLOT_INTERVAL } from "@/lib/constants";

type AvailabilityStatus = "UNAVAILABLE" | "AVAILABLE" | "FREE" | "PREFER_OFF";

const availabilitySchema = z.object({
  periodId: z.string(),
  date: z.string(),
  status: z.enum(["UNAVAILABLE", "AVAILABLE", "FREE", "PREFER_OFF"]),
  startMin: z.number().nullable().optional(),
  endMin: z.number().nullable().optional(),
  note: z.string().optional(),
});

const bulkAvailabilitySchema = z.object({
  periodId: z.string(),
  items: z.array(
    z.object({
      date: z.string(),
      status: z.enum(["UNAVAILABLE", "AVAILABLE", "FREE", "PREFER_OFF"]),
      startMin: z.number().nullable().optional(),
      endMin: z.number().nullable().optional(),
      note: z.string().optional(),
    })
  ),
});

function validateTimeRange(
  status: AvailabilityStatus,
  startMin: number | null | undefined,
  endMin: number | null | undefined
): string | null {
  if (status === "UNAVAILABLE") {
    return null; // No time validation needed
  }

  // For FREE, default to full business hours
  if (status === "FREE") {
    return null;
  }

  // For AVAILABLE and PREFER_OFF, validate times
  if (startMin === null || startMin === undefined || endMin === null || endMin === undefined) {
    return "開始時間と終了時間を指定してください";
  }

  if (startMin < BUSINESS_START_MIN || endMin > BUSINESS_END_MIN) {
    return "営業時間外は選択できません（10:00〜20:30）";
  }

  if (startMin >= endMin) {
    return "終了時間は開始時間より後にしてください";
  }

  if (startMin % TIME_SLOT_INTERVAL !== 0 || endMin % TIME_SLOT_INTERVAL !== 0) {
    return "時間は30分刻みで指定してください";
  }

  return null;
}

// GET: Get availability for a period
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");
    const staffUserId = searchParams.get("staffUserId");

    if (!periodId) {
      return NextResponse.json(
        { error: "periodIdは必須です" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { periodId };

    // Staff can only see their own availability
    if (user.role === "STAFF") {
      where.staffUserId = user.id;
    } else if (staffUserId) {
      where.staffUserId = staffUserId;
    }

    const availabilities = await prisma.availability.findMany({
      where,
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ staffUserId: "asc" }, { date: "asc" }],
    });

    return NextResponse.json({ availabilities });
  } catch (error) {
    console.error("Failed to fetch availability:", error);
    return NextResponse.json(
      { error: "希望の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Create or update availability
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();

    // Check if bulk update
    if (body.items) {
      const parsed = bulkAvailabilitySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0].message },
          { status: 400 }
        );
      }

      // Check period is open
      const period = await prisma.shiftPeriod.findUnique({
        where: { id: parsed.data.periodId },
      });

      if (!period) {
        return NextResponse.json(
          { error: "期間が見つかりません" },
          { status: 404 }
        );
      }

      if (!period.isOpen && user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "この期間は受付を終了しています" },
          { status: 400 }
        );
      }

      // Validate all items
      for (const item of parsed.data.items) {
        const error = validateTimeRange(
          item.status as AvailabilityStatus,
          item.startMin,
          item.endMin
        );
        if (error) {
          return NextResponse.json({ error }, { status: 400 });
        }
      }

      // Upsert all availabilities
      const results = await Promise.all(
        parsed.data.items.map(async (item) => {
          const date = new Date(item.date);
          const startMin =
            item.status === "FREE"
              ? BUSINESS_START_MIN
              : item.status === "UNAVAILABLE"
                ? null
                : item.startMin ?? null;
          const endMin =
            item.status === "FREE"
              ? BUSINESS_END_MIN
              : item.status === "UNAVAILABLE"
                ? null
                : item.endMin ?? null;

          return prisma.availability.upsert({
            where: {
              periodId_staffUserId_date: {
                periodId: parsed.data.periodId,
                staffUserId: user.id,
                date,
              },
            },
            update: {
              status: item.status as AvailabilityStatus,
              startMin,
              endMin,
              note: item.note,
            },
            create: {
              periodId: parsed.data.periodId,
              staffUserId: user.id,
              date,
              status: item.status as AvailabilityStatus,
              startMin,
              endMin,
              note: item.note,
            },
          });
        })
      );

      return NextResponse.json({ availabilities: results });
    }

    // Single item update
    const parsed = availabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Check period is open
    const period = await prisma.shiftPeriod.findUnique({
      where: { id: parsed.data.periodId },
    });

    if (!period) {
      return NextResponse.json(
        { error: "期間が見つかりません" },
        { status: 404 }
      );
    }

    if (!period.isOpen && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "この期間は受付を終了しています" },
        { status: 400 }
      );
    }

    const error = validateTimeRange(
      parsed.data.status as AvailabilityStatus,
      parsed.data.startMin,
      parsed.data.endMin
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const date = new Date(parsed.data.date);
    const startMin =
      parsed.data.status === "FREE"
        ? BUSINESS_START_MIN
        : parsed.data.status === "UNAVAILABLE"
          ? null
          : parsed.data.startMin ?? null;
    const endMin =
      parsed.data.status === "FREE"
        ? BUSINESS_END_MIN
        : parsed.data.status === "UNAVAILABLE"
          ? null
          : parsed.data.endMin ?? null;

    const availability = await prisma.availability.upsert({
      where: {
        periodId_staffUserId_date: {
          periodId: parsed.data.periodId,
          staffUserId: user.id,
          date,
        },
      },
      update: {
        status: parsed.data.status as AvailabilityStatus,
        startMin,
        endMin,
        note: parsed.data.note,
      },
      create: {
        periodId: parsed.data.periodId,
        staffUserId: user.id,
        date,
        status: parsed.data.status as AvailabilityStatus,
        startMin,
        endMin,
        note: parsed.data.note,
      },
    });

    return NextResponse.json({ availability });
  } catch (error) {
    console.error("Failed to save availability:", error);
    return NextResponse.json(
      { error: "希望の保存に失敗しました" },
      { status: 500 }
    );
  }
}
