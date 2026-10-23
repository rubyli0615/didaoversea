import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { generateAccessKey, getCurrentUser, hashAccessKey, revokeAllSessions, writeAudit } from "@/lib/auth";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "仅管理员可重置 Key" }, { status: 403 });
  const { id } = await context.params;
  if(!(await getDb().select({id:users.id}).from(users).where(eq(users.id,id)).limit(1))[0])return NextResponse.json({error:"账号不存在"},{status:404});
  const key = generateAccessKey();
  const credential = await hashAccessKey(key);
  const now = Math.floor(Date.now() / 1000);
  await getDb().update(users).set({
    keySalt: credential.salt, keyHash: credential.hash, keyUpdatedAt: now, updatedAt: now,
  }).where(eq(users.id, id));
  await revokeAllSessions(id);
  await writeAudit(actor.id, "RESET_ACCESS_KEY", "USER", id);
  return NextResponse.json({ key }, {headers:{"Cache-Control":"private, no-store"}});
}
