import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { websiteCategories } from "@/db/schema";
import { canCreate, getCurrentUser, writeAudit } from "@/lib/auth";
import { isWebsiteScenario } from "@/lib/website-categories";

export async function PUT(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权管理网站分类" }, { status: 403 });
  const body = await request.json().catch(() => null) as { scenario?: unknown; ids?: unknown } | null;
  if (!isWebsiteScenario(body?.scenario) || !Array.isArray(body?.ids) || body.ids.length > 200 || body.ids.some(id => typeof id !== "string") || new Set(body.ids).size !== body.ids.length) return NextResponse.json({ error: "请提交有效且不重复的分类顺序" }, { status: 400 });
  const ids = body.ids as string[];
  const db = getDb();
  const current = await db.select({ id: websiteCategories.id }).from(websiteCategories).where(eq(websiteCategories.scenario, body.scenario));
  if (ids.length !== current.length || current.some(category => !ids.includes(category.id))) return NextResponse.json({ error: "分类列表已变化，请关闭后重新打开分类管理" }, { status: 409 });
  const now = Math.floor(Date.now() / 1000);
  const updates = ids.map((id, sortOrder) => db.update(websiteCategories).set({ sortOrder, updatedAt: now }).where(eq(websiteCategories.id, id)));
  if (updates.length) await db.batch(updates as [typeof updates[number], ...typeof updates[number][]]);
  await writeAudit(actor.id, "REORDER_WEBSITE_CATEGORIES", "WEBSITE_CATEGORY", undefined, JSON.stringify({ scenario: body.scenario, ids }));
  return NextResponse.json({ ok: true });
}
