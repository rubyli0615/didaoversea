import { readResourceCatalog } from "@/lib/resource-catalog";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashAccessKey, verifyAccessKey, writeAudit } from "@/lib/auth";
import { ensureBootstrapData } from "@/lib/bootstrap";

export async function POST(request: Request) {
  const started=performance.now();
  const body = await request.json().catch(()=>null) as { email?: unknown; key?: unknown } | null;
  const email = typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const key = typeof body?.key==="string"?body.key.trim():"";
  if (!email || !key || email.length>254 || key.length>512) return NextResponse.json({ error: "请输入账号和 Access Key" }, { status: 400 });

  const db = getDb();
  let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  // Existing accounts do not run seeding on every sign-in. New installations still initialize safely.
  if (!user) { await ensureBootstrapData(); user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0]; }
  if (!user || !user.active) return NextResponse.json({ error: "账号或 Access Key 不正确" }, { status: 401 });

  let valid = false;
  if (user.keyHash && user.keySalt) {
    valid = await verifyAccessKey(key, user.keySalt, user.keyHash);
  } else {
    const bootstrapKey = env.BOOTSTRAP_RUBY_KEY ?? process.env.BOOTSTRAP_RUBY_KEY;
    if (email === "ruby.li@dida.com" && bootstrapKey && key === bootstrapKey) {
    const credential = await hashAccessKey(key);
    await db.update(users).set({
      keySalt: credential.salt,
      keyHash: credential.hash,
      keyUpdatedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    }).where(eq(users.id, user.id));
    valid = true;
    }
  }
  if (!valid) return NextResponse.json({ error: "账号或 Access Key 不正确" }, { status: 401 });


  const safeUser = { id: user.id, email: user.email, displayName: user.displayName, role: user.role, active: user.active };
  const [, , catalog] = await Promise.all([createSession(user.id), writeAudit(user.id,"LOGIN","USER",user.id), (async()=>{await ensureBootstrapData();return readResourceCatalog(safeUser,true);})()]);
  return NextResponse.json({ user: safeUser, ...catalog }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `login;dur=${(performance.now()-started).toFixed(1)}` } });
}
