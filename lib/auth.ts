import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import type { Role, SafeUser } from "@/lib/resource-types";

export const SESSION_COOKIE = "dida_ai_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const ACCESS_KEY_KDF_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 24) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

export function generateAccessKey() {
  return `DIDA-${randomHex(12).toUpperCase()}`;
}

export async function hashAccessKey(key: string, saltHex?: string) {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ACCESS_KEY_KDF_ITERATIONS },
    material,
    256,
  );
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
}

export async function verifyAccessKey(key: string, salt: string, expected: string) {
  const actual = (await hashAccessKey(key, salt)).hash;
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export async function createSession(userId: string) {
  const db = getDb();
  const token = randomHex(32);
  const now = Math.floor(Date.now() / 1000);
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashToken(token),
    createdAt: now,
    expiresAt: now + SESSION_SECONDS,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function revokeCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb()
      .update(sessions)
      .set({ revokedAt: Math.floor(Date.now() / 1000) })
      .where(eq(sessions.tokenHash, await hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string) {
  await getDb()
    .update(sessions)
    .set({ revokedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const rows = await getDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, await hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return (rows[0] as SafeUser | undefined) ?? null;
}

export function canCreate(role: Role) {
  return role === "ADMIN" || role === "CREATOR";
}

export async function writeAudit(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId?: string,
  detail?: string,
) {
  await getDb().insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    targetType,
    targetId: targetId ?? null,
    detail: detail ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}
