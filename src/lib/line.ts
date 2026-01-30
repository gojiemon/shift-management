import { messagingApi, validateSignature } from "@line/bot-sdk";

// Check if LINE is configured
export function isLineConfigured(): boolean {
  return !!(
    process.env.LINE_CHANNEL_SECRET &&
    process.env.LINE_CHANNEL_ACCESS_TOKEN &&
    process.env.LINE_CHANNEL_SECRET.length > 0 &&
    process.env.LINE_CHANNEL_ACCESS_TOKEN.length > 0
  );
}

// Get LINE client (returns null if not configured)
export function getLineClient(): messagingApi.MessagingApiClient | null {
  if (!isLineConfigured()) {
    return null;
  }

  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  });
}

// Verify webhook signature
export function verifyLineSignature(body: string, signature: string): boolean {
  if (!process.env.LINE_CHANNEL_SECRET) {
    return false;
  }
  return validateSignature(body, process.env.LINE_CHANNEL_SECRET, signature);
}

// Send push message
export async function sendPushMessage(userId: string, message: string): Promise<boolean> {
  const client = getLineClient();
  if (!client) {
    console.log("LINE is not configured, skipping push message");
    return false;
  }

  try {
    await client.pushMessage({
      to: userId,
      messages: [{ type: "text", text: message }],
    });
    return true;
  } catch (error) {
    console.error("Failed to send LINE message:", error);
    return false;
  }
}

// Send reply message
export async function sendReplyMessage(replyToken: string, message: string): Promise<boolean> {
  const client = getLineClient();
  if (!client) {
    console.log("LINE is not configured, skipping reply message");
    return false;
  }

  try {
    await client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: message }],
    });
    return true;
  } catch (error) {
    console.error("Failed to send LINE reply:", error);
    return false;
  }
}

// Generate random link code
export function generateLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude similar chars (0,O,1,I)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
