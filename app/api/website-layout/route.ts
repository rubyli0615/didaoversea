import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resources, teamWebsites, websiteCategories, websiteLayouts } from "@/db/schema";
import { canCreate, getCurrentUser } from "@/lib/auth";
import { ensureBootstrapData } from "@/lib/bootstrap";
import { canEditTeamWebsites, WEBSITE_TEAMS } from "@/lib/team-websites";
import { orderedWebsites } from "@/lib/website-layout";

function ids(value: string): string[] { try { const list = JSON.parse(value); return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []; } catch { return []; } }
export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  await ensureBootstrapData();
  const [categories, websites, layouts] = await getDb().batch([
    getDb().select().from(websiteCategories).orderBy(asc(websiteCategories.sortOrder),asc(websiteCategories.id)),
    getDb().select({ id:teamWebsites.id, teamId:teamWebsites.teamId, name:teamWebsites.name, description:teamWebsites.description, url:teamWebsites.url, updatedAt:teamWebsites.updatedAt }).from(teamWebsites),
    getDb().select({scenario:websiteLayouts.scenario,siteIds:websiteLayouts.siteIds,groupIds:websiteLayouts.groupIds,revision:websiteLayouts.revision}).from(websiteLayouts),
  ]);
  return NextResponse.json({ categories, websites, layouts:layouts.map(row=>({...row,siteIds:ids(row.siteIds),groupIds:ids(row.groupIds)})) }, { headers:{"Cache-Control":"private, no-store"} });
}
export async function PUT(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error:"未登录" }, { status:401 });
  const body = await request.json().catch(()=>null) as { scenario?:string;revision?:number;siteId?:string;beforeId?:string|null;groupId?:string;groupIds?:string[] } | null;
  if (!body || !["overseas_op","ai_tools","teams"].includes(body.scenario??"") || !Number.isSafeInteger(body.revision) || (body.revision ?? -1) < 0) return NextResponse.json({error:"排序请求无效"},{status:400});
  const scenario = body.scenario as string, db = getDb();
  const stored = (await db.select().from(websiteLayouts).where(eq(websiteLayouts.scenario,scenario)))[0];
  const revision = stored?.revision ?? 0;
  if (revision !== body.revision) return NextResponse.json({error:"其他人已调整顺序，请重试后再移动"},{status:409});
  let siteIds = ids(stored?.siteIds ?? "[]"), groupIds = ids(stored?.groupIds ?? "[]");
  const now = Math.floor(Date.now()/1000);
  const operationId = crypto.randomUUID();
  const ownsMove = sql`exists (select 1 from website_layouts where scenario = ${scenario} and operation_id = ${operationId})`;
  const updates: Parameters<typeof db.batch>[0][number][] = [];
  if (Array.isArray(body.groupIds)) {
    if (scenario !== "teams" || !canCreate(actor.role)) return NextResponse.json({error:"无权调整分组顺序"},{status:403});
    if (body.groupIds.length !== WEBSITE_TEAMS.length || new Set(body.groupIds).size !== body.groupIds.length || WEBSITE_TEAMS.some(team=>!body.groupIds!.includes(team.id))) return NextResponse.json({error:"分组列表已变化"},{status:409});
    groupIds = body.groupIds;
  } else {
    if (typeof body.siteId !== "string" || typeof body.groupId !== "string" || !(body.beforeId === null || typeof body.beforeId === "string")) return NextResponse.json({error:"请选择网站和目标分组"},{status:400});
    const websites = scenario === "teams"
      ? (await db.select({id:teamWebsites.id,name:teamWebsites.name,url:teamWebsites.url,teamId:teamWebsites.teamId}).from(teamWebsites)).map(site=>({id:site.id,name:site.name,groupId:site.teamId,url:site.url}))
      : (await db.select({id:resources.id,name:resources.name,websiteCategoryId:resources.websiteCategoryId}).from(resources).where(and(eq(resources.type,"INTERNAL"),eq(resources.status,"PUBLISHED"),eq(resources.scenario,scenario)))).map(site=>({id:site.id,name:site.name,groupId:site.websiteCategoryId??"unclassified"}));
    const moving = websites.find(site=>site.id===body.siteId), before = websites.find(site=>site.id===body.beforeId!);
    if (!moving || body.beforeId !== null && (!before || before.groupId !== body.groupId || before.id === moving.id)) return NextResponse.json({error:"网站列表已变化，请重试"},{status:409});
    if (scenario === "teams") {
      if (!canEditTeamWebsites(actor,moving.groupId) || !canEditTeamWebsites(actor,body.groupId)) return NextResponse.json({error:"仅可调整有编辑权限的小组网站"},{status:403});
      if (!WEBSITE_TEAMS.some(team=>team.id===body.groupId)) return NextResponse.json({error:"小组无效"},{status:400});
      // Prevent a duplicate URL when moving a shortcut to another team.
      if (websites.some(site=>site.id!==moving.id && site.groupId===body.groupId && "url" in site && "url" in moving && site.url===moving.url)) return NextResponse.json({error:"目标小组已收录这个网址"},{status:409});
      updates.push(db.update(teamWebsites).set({teamId:body.groupId,updatedBy:actor.id,updatedAt:now}).where(and(eq(teamWebsites.id,moving.id),eq(teamWebsites.teamId,moving.groupId),ownsMove)));
    } else {
      if (!canCreate(actor.role)) return NextResponse.json({error:"无权移动网站"},{status:403});
      if (body.groupId !== "unclassified" && !(await db.select().from(websiteCategories).where(and(eq(websiteCategories.id,body.groupId),eq(websiteCategories.scenario,scenario))))[0]) return NextResponse.json({error:"目标分类已删除"},{status:409});
      updates.push(db.update(resources).set({websiteCategoryId:body.groupId==="unclassified"?null:body.groupId,updatedAt:now}).where(and(eq(resources.id,moving.id),ownsMove)));
    }
    siteIds = orderedWebsites(websites,siteIds).map(site=>site.id).filter(id=>id!==moving.id);
    const target = body.beforeId === null ? siteIds.length : siteIds.indexOf(body.beforeId);
    siteIds.splice(target,0,moving.id);
  }
  // D1 batch is transactional. A failed optimistic guard rolls back the entire move.
  const guard = db.insert(websiteLayouts).values({scenario,operationId,siteIds:JSON.stringify(siteIds),groupIds:JSON.stringify(groupIds),revision:revision+1,updatedAt:now})
    .onConflictDoUpdate({target:websiteLayouts.scenario,set:{operationId,siteIds:JSON.stringify(siteIds),groupIds:JSON.stringify(groupIds),revision:revision+1,updatedAt:now},setWhere:eq(websiteLayouts.revision,revision)}).returning({revision:websiteLayouts.revision});
  try {
    const [changed] = await db.batch([guard,...updates]);
    if (!changed.length) return NextResponse.json({error:"顺序已变化，请重试"},{status:409});
  }
  catch { return NextResponse.json({error:"移动未完成，请重新加载目录后重试"},{status:409}); }
  return NextResponse.json({ok:true,layout:{scenario,siteIds,groupIds,revision:revision+1}});
}
