import { NextResponse } from "next/server";
import { isLineConfigured } from "@/lib/line";

export async function GET() {
  return NextResponse.json({ enabled: isLineConfigured() });
}
