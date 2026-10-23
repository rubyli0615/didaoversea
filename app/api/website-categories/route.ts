import { asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { websiteCategories } from "@/db/schema";
import { canCreate, getCurrentUser, writeAudit } from "@/lib/auth";
import { ensureBootstrapData } from "@/lib/bootstrap";
import { categoryNameInput, isWebsiteScenario } from "@/lib/website-categories";

export async function GET() {
  if (!await getCurrentUser()) return NextResponse.json({ error: "未登录" }, { status: 401 });
  await ensureBootstrapData();
  const categories = await getDb().select().from(websiteCategories).orderBy(asc(websiteCategories.sortOrder), asc(websiteCategories.id));
  return NextResponse.json({ categories }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权管理网站分类" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const input = categoryNameInput(body?.name);
  if (!input || !isWebsiteScenario(body?.scenario)) return NextResponse.json({ error: "请填写分类名称（最多 40 字）并选择网站目录" }, { status: 400 });
  const now = Math.floor(Date.now()/1000), id = crypto.randomUUID();
  const inserted = await getDb().insert(websiteCategories).values({ id, scenario: body.scenario, ...input, sortOrder: sql`coalesce((select max(sort_order) from website_categories where scenario = ${body.scenario}), -1) + 1`, createdAt: now, updatedAt: now }).onConflictDoNothing().returning({ id: websiteCategories.id });
  if (!inserted.length) return NextResponse.json({ error: "该目录已有同名分类" }, { status: 409 });
  await writeAudit(actor.id, "CREATE_WEBSITE_CATEGORY", "WEBSITE_CATEGORY", id, input.name);
  return NextResponse.json({ id }, { status: 201 });
}
