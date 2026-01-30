import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, sendReplyMessage, isLineConfigured } from "@/lib/line";

interface LineEvent {
  type: string;
  replyToken: string;
  source: {
    type: string;
    userId: string;
  };
  message?: {
    type: string;
    text: string;
  };
}

interface LineWebhookBody {
  events: LineEvent[];
}

export async function POST(request: NextRequest) {
  try {
    if (!isLineConfigured()) {
      return NextResponse.json({ error: "LINE is not configured" }, { status: 400 });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!signature || !verifyLineSignature(rawBody, signature)) {
      console.error("Invalid LINE signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body: LineWebhookBody = JSON.parse(rawBody);

    for (const event of body.events) {
      // Handle follow event
      if (event.type === "follow") {
        await sendReplyMessage(
          event.replyToken,
          "友だち追加ありがとうございます！\nシフト管理システムと連携するには、アプリで発行した連携コードを送信してください。"
        );
        continue;
      }

      // Handle message event
      if (event.type === "message" && event.message?.type === "text") {
        const text = event.message.text.trim().toUpperCase();
        const lineUserId = event.source.userId;

        // Check if it's a link code
        const linkCode = await prisma.lineLinkCode.findUnique({
          where: { code: text },
          include: { staff: true },
        });

        if (linkCode) {
          // Check if code is expired
          if (linkCode.expiresAt < new Date()) {
            await sendReplyMessage(
              event.replyToken,
              "このコードは有効期限切れです。\nアプリで新しいコードを発行してください。"
            );
            continue;
          }

          // Check if code is already used
          if (linkCode.usedAt) {
            await sendReplyMessage(
              event.replyToken,
              "このコードは既に使用されています。"
            );
            continue;
          }

          // Check if user is already linked
          const existingLink = await prisma.lineLink.findUnique({
            where: { staffUserId: linkCode.staffUserId },
          });

          if (existingLink) {
            await sendReplyMessage(
              event.replyToken,
              "このアカウントは既にLINE連携されています。"
            );
            continue;
          }

          // Create link
          await prisma.$transaction([
            prisma.lineLink.create({
              data: {
                staffUserId: linkCode.staffUserId,
                lineUserId,
              },
            }),
            prisma.lineLinkCode.update({
              where: { id: linkCode.id },
              data: { usedAt: new Date() },
            }),
          ]);

          await sendReplyMessage(
            event.replyToken,
            `${linkCode.staff.name}さんのLINE連携が完了しました！\nシフトの通知を受け取れるようになりました。`
          );
          continue;
        }

        // Unknown message
        await sendReplyMessage(
          event.replyToken,
          "シフト管理システムです。\n連携するには、アプリで発行した8桁の連携コードを送信してください。"
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
