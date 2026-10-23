import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resources, websiteCategories } from "@/db/schema";
import { canCreate, getCurrentUser, writeAudit } from "@/lib/auth";
import { categoryNameInput } from "@/lib/website-categories";

export async function PUT(request: Request, context: { params: Promise<{id:string}> }) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权管理网站分类" }, { status: 403 });
  const { id } = await context.params, db = getDb();
  if (!(await db.select().from(websiteCategories).where(eq(websiteCategories.id,id)).limit(1))[0]) return NextResponse.json({ error: "分类不存在" }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null, input = categoryNameInput(body?.name);
  if (!input) return NextResponse.json({ error: "请填写分类名称，最多 40 字" }, { status: 400 });
  try { await db.update(websiteCategories).set({ ...input, updatedAt: Math.floor(Date.now()/1000) }).where(eq(websiteCategories.id,id)); }
  catch(error) { if (/unique constraint/i.test(String(error)+String((error as Error)?.cause))) return NextResponse.json({ error:"该目录已有同名分类" },{status:409}); throw error; }
  await writeAudit(actor.id,"UPDATE_WEBSITE_CATEGORY","WEBSITE_CATEGORY",id,input.name);
  return NextResponse.json({ok:true});
}
export async function DELETE(_: Request, context: { params: Promise<{id:string}> }) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权管理网站分类" }, { status: 403 });
  const { id } = await context.params, db = getDb();
  if (!(await db.select().from(websiteCategories).where(eq(websiteCategories.id,id)).limit(1))[0]) return NextResponse.json({ error: "分类不存在" }, { status: 404 });
  await db.batch([db.update(resources).set({websiteCategoryId:null}).where(eq(resources.websiteCategoryId,id)),db.delete(websiteCategories).where(eq(websiteCategories.id,id))]);
  await writeAudit(actor.id,"DELETE_WEBSITE_CATEGORY","WEBSITE_CATEGORY",id,"网站保留，移至未分类");
  return NextResponse.json({ok:true});
}
