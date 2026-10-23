import { eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { generateAccessKey, getCurrentUser, hashAccessKey, writeAudit } from "@/lib/auth";

export async function POST() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "仅管理员可初始化 Key" }, { status: 403 });
  const db = getDb();
  const pending = await db.select({id:users.id,email:users.email}).from(users).where(isNull(users.keyHash));
  const credentials: Array<{ email: string; key: string }> = [];
  const now = Math.floor(Date.now() / 1000);
  for (const user of pending) {
    const key = generateAccessKey();
    const credential = await hashAccessKey(key);
    await db.update(users).set({
      keySalt: credential.salt, keyHash: credential.hash, keyUpdatedAt: now, updatedAt: now,
    }).where(eq(users.id, user.id));
    credentials.push({ email: user.email, key });
  }
  await writeAudit(actor.id, "GENERATE_INITIAL_KEYS", "USER", undefined, `${credentials.length} accounts`);
  return NextResponse.json({ credentials }, {headers:{"Cache-Control":"private, no-store"}});
}
