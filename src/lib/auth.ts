import { cookies } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

const SESSION_COOKIE_NAME = "session_id";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return session.id;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const sessionId = await getSessionId();
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: sessionId } });
    }
    return null;
  }

  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    redirect("/staff/periods");
  }
  return user;
}

export async function requireStaff() {
  const user = await requireAuth();
  if (user.role !== "STAFF") {
    redirect("/admin/periods");
  }
  return user;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function login(loginId: string, password?: string) {
  const user = await prisma.user.findUnique({
    where: { loginId },
  });

  if (!user) {
    return { error: "ログインIDが見つかりません" };
  }

  // パスワードが指定された場合のみ検証（開発用にスキップ可能）
  if (password && password.length > 0) {
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { error: "パスワードが正しくありません" };
    }
  }

  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId);

  return { user };
}

export async function logout() {
  const sessionId = await getSessionId();
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    await deleteSessionCookie();
  }
}
