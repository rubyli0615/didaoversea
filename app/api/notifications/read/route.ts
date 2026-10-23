import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resourceReads, resources } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isNotifiableResource } from "@/lib/resource-notifications";

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: { items?: Array<{ resourceId: string; revision: number }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请检查已读记录" }, { status: 400 }); }
  if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 100 || body.items.some((item) => !item || typeof item.resourceId !== "string" || !Number.isSafeInteger(item.revision) || item.revision < 1)) return NextResponse.json({ error: "请检查已读记录" }, { status: 400 });
  const items = [...new Map(body.items.map((item) => [item.resourceId, item])).values()];
  const db = getDb();
  const rows = await db.select({id:resources.id,type:resources.type,notificationRevision:resources.notificationRevision}).from(resources).where(and(inArray(resources.id, items.map((item) => item.resourceId)), eq(resources.status, "PUBLISHED")));
  if (items.some((item) => !rows.some((row) => row.id === item.resourceId && isNotifiableResource(row.type)))) return NextResponse.json({ error: "资源已移除或不可访问" }, { status: 404 });
  if (items.some((item) => item.revision > rows.find((row) => row.id === item.resourceId)!.notificationRevision)) return NextResponse.json({ error: "不能提前标记尚未发布的更新" }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  // A late acknowledgement can only advance the observed revision, never hide a newer update.
  const writes = items.map((item) => db.insert(resourceReads).values({ id: crypto.randomUUID(), userId: actor.id, resourceId: item.resourceId, revision: item.revision, readAt: now }).onConflictDoUpdate({ target: [resourceReads.userId, resourceReads.resourceId], set: { revision: sql`max(${resourceReads.revision}, ${item.revision})`, readAt: now } }));
  await db.batch(writes as [typeof writes[number], ...typeof writes[number][]]);
  return NextResponse.json({ ok: true });
}
