import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  loginId: z.string().min(1, "ログインIDは必須です"),
  password: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const result = await login(parsed.data.loginId, parsed.data.password);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: result.user!.id,
        name: result.user!.name,
        role: result.user!.role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}
