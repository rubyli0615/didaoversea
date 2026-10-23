import type {BatchItem} from "drizzle-orm/batch";
import {visibleResourceFilter} from "@/lib/resource-access";
import { and, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resources, skillRelations } from "@/db/schema";
import { canCreate, getCurrentUser, writeAudit } from "@/lib/auth";
import { isNotifiableResource, resourceContentChanged, relationSignature } from "@/lib/resource-notifications";
import { parseCommonQa, parsePermissions, validateResourceContent, type RelationInput } from "@/lib/resource-input";
import { canEditResource, type ResourceModule } from "@/lib/resource-modules";
import { validWebsiteCategory } from "@/lib/website-category-validation";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权修改资源" }, { status: 403 });
  const { id } = await context.params;
  const db = getDb();
  const existing = (await db.select().from(resources).where(eq(resources.id, id)).limit(1))[0];
  if (!existing) return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  if (!canEditResource(actor, existing)) return NextResponse.json({ error: "无权修改此模块的资源" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  if (existing.type === "OTHER") { if (body.detail !== undefined) body.summary = String(body.detail).trim().slice(0,200); if (body.scenario !== undefined) body.scenario = String(body.scenario).trim(); }
  const validationError = validateResourceContent(body, existing.type, false);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  if (existing.type === "INTERNAL" && !await validWebsiteCategory(body.websiteCategoryId !== undefined ? body.websiteCategoryId : existing.websiteCategoryId, body.scenario ?? existing.scenario)) return NextResponse.json({ error: "网站分类不存在或不属于当前目录" }, { status: 400 });
  const relationFields = ["previousSkillId", "nextSkillId"];
  let visibleSkillIds=new Set<string>();
  if (existing.type === "SKILL") {
    const candidates = await db.select({id:resources.id}).from(resources).where(and(eq(resources.type,"SKILL"),visibleResourceFilter(actor)));
    visibleSkillIds=new Set(candidates.map(item=>item.id));
    for (const field of relationFields) if (body[field] && (body[field] === id || !candidates.some((item) => item.id === body[field]))) return NextResponse.json({ error: "请选择有效的关联 Skill，不能关联自身" }, { status: 400 });
    for (const link of (body.relationLinks ?? []) as RelationInput[]) if (link.targetId === id || !candidates.some((item) => item.id === link.targetId)) return NextResponse.json({ error: "请选择有效的关联 Skill，不能关联自身" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const changes = {
    name: String(body.name ?? existing.name),
    resourceModule: body.resourceModule !== undefined ? body.resourceModule as ResourceModule : existing.resourceModule,
    businessDirection: body.businessDirection !== undefined ? (body.businessDirection ? String(body.businessDirection) : null) : existing.businessDirection,
    scenario: body.scenario !== undefined ? (body.scenario ? String(body.scenario) : null) : existing.scenario,
    summary: String(body.summary ?? existing.summary),
    version: body.version !== undefined ? (String(body.version).trim() || null) : existing.version,
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : JSON.parse(existing.tags)),
    detail: String(body.detail ?? existing.detail),
    installationCommand: body.installationCommand !== undefined ? String(body.installationCommand) || null : existing.installationCommand,
    usageExample: body.usageExample !== undefined ? String(body.usageExample) || null : existing.usageExample,
    usageInstructions: body.usageInstructions !== undefined ? String(body.usageInstructions) || null : existing.usageInstructions,
    documentationUrl: body.documentationUrl !== undefined ? (body.documentationUrl ? String(body.documentationUrl) : null) : existing.documentationUrl,
    referenceUrl: body.referenceUrl !== undefined ? (body.referenceUrl ? String(body.referenceUrl) : null) : existing.referenceUrl,
    commonQa: body.commonQa !== undefined ? JSON.stringify(parseCommonQa(body.commonQa)) : existing.commonQa,
    websiteCategoryId: existing.type === "INTERNAL" && body.websiteCategoryId !== undefined ? (body.websiteCategoryId ? String(body.websiteCategoryId) : null) : existing.websiteCategoryId,
    implementation: body.implementation !== undefined ? String(body.implementation) || null : existing.implementation,
    contact: body.contact !== undefined ? String(body.contact) || null : existing.contact,
    caseUrl: body.caseUrl !== undefined ? String(body.caseUrl) || null : existing.caseUrl,
    installationMode: body.installationMode !== undefined ? String(body.installationMode) : existing.installationMode,
    repositoryAccess: body.repositoryAccess !== undefined ? String(body.repositoryAccess) : existing.repositoryAccess,
    repositoryInstructions: body.repositoryInstructions !== undefined ? String(body.repositoryInstructions) || null : existing.repositoryInstructions,
    mcpRequirements: body.mcpRequirements !== undefined ? String(body.mcpRequirements) || null : existing.mcpRequirements,
    tablePermissionReason: existing.type !== "SKILL" ? null : body.tablePermissionReason !== undefined ? String(body.tablePermissionReason).trim() || null : existing.tablePermissionReason,
    dataPermissions: body.dataPermissions !== undefined ? JSON.stringify(parsePermissions(body.dataPermissions)) : existing.dataPermissions,
    contentRevision: Math.max(existing.contentRevision, 37) + 1,
    sourceUrl: body.sourceUrl !== undefined ? (body.sourceUrl ? String(body.sourceUrl) : null) : existing.sourceUrl,
    accessData: body.accessData !== undefined ? (body.accessData ? String(body.accessData) : null) : existing.accessData,
    accessMethod: body.accessMethod !== undefined ? (body.accessMethod ? String(body.accessMethod) : null) : existing.accessMethod,
    toolList: JSON.stringify(Array.isArray(body.toolList) ? body.toolList : JSON.parse(existing.toolList)),
    toolDescriptions: body.toolDescriptions !== undefined ? JSON.stringify(body.toolDescriptions) : existing.toolDescriptions,
    knowledgeScope: body.knowledgeScope !== undefined ? (body.knowledgeScope ? String(body.knowledgeScope) : null) : existing.knowledgeScope,
    releaseNote: body.releaseNote !== undefined ? String(body.releaseNote) || null : existing.releaseNote,
    status: body.status === "PUBLISHED" && actor.role === "ADMIN" ? "PUBLISHED" : existing.status,
    updatedAt: now,
  } satisfies Partial<typeof resources.$inferInsert>;
  let relationChanged = false;
  let replacementLinks:Array<{sourceSkillId:string;targetSkillId:string;triggerCondition:string}>|null=null;
  if (existing.type === "SKILL" && (Array.isArray(body.relationLinks) || relationFields.some((field) => body[field] !== undefined))) {
    const currentLinks = await db.select().from(skillRelations).where(or(eq(skillRelations.sourceSkillId, id), eq(skillRelations.targetSkillId, id)));
    const nextLinks = Array.isArray(body.relationLinks) ? (body.relationLinks as RelationInput[]).map((link) => ({ sourceSkillId: link.direction === "before" ? link.targetId : id, targetSkillId: link.direction === "before" ? id : link.targetId, triggerCondition: link.condition || "推荐组合使用" })) : [
      ...(body.previousSkillId ? [{ sourceSkillId: String(body.previousSkillId), targetSkillId: id, triggerCondition: String(body.previousCondition || "建议先完成前置分析") }] : []),
      ...(body.nextSkillId ? [{ sourceSkillId: id, targetSkillId: String(body.nextSkillId), triggerCondition: String(body.nextCondition || "推荐继续使用") }] : []),
    ];
    // A creator must not silently erase an invisible draft association while editing a published Skill.
    const protectedLinks=currentLinks.filter(link=>!visibleSkillIds.has(link.sourceSkillId===id?link.targetSkillId:link.sourceSkillId));
    replacementLinks=[...nextLinks,...protectedLinks];
    relationChanged = relationSignature(currentLinks) !== relationSignature(replacementLinks);
  }
  const notify = changes.status === "PUBLISHED" && isNotifiableResource(existing.type) && (existing.status !== "PUBLISHED" || resourceContentChanged(existing, changes) || relationChanged);
  const writes:BatchItem<"sqlite">[]=[db.update(resources).set({ ...changes, ...(notify ? { notificationRevision: sql`${resources.notificationRevision} + 1`, notificationKind: existing.status !== "PUBLISHED" ? "new" as const : "updated" as const, notificationAt: now } : {}) }).where(eq(resources.id, id))];

  if(replacementLinks){
    writes.push(db.delete(skillRelations).where(or(eq(skillRelations.sourceSkillId,id),eq(skillRelations.targetSkillId,id))));
    for(const link of replacementLinks)writes.push(db.insert(skillRelations).values({id:crypto.randomUUID(),...link,createdAt:now}));
  }
  await db.batch(writes as [BatchItem<"sqlite">,...BatchItem<"sqlite">[]]);
  await writeAudit(actor.id, "UPDATE_RESOURCE", "RESOURCE", id, existing.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权删除资源" }, { status: 403 });
  const { id } = await context.params;
  const db = getDb();
  const existing = (await db.select().from(resources).where(eq(resources.id, id)).limit(1))[0];
  if (!existing) return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  if (actor.role !== "ADMIN" && existing.ownerId !== actor.id) return NextResponse.json({ error: "只能删除自己创建的资源" }, { status: 403 });
  await db.update(resources).set({ status: "ARCHIVED", updatedAt: Math.floor(Date.now() / 1000) }).where(eq(resources.id, id));
  await writeAudit(actor.id, "ARCHIVE_RESOURCE", "RESOURCE", id, existing.name);
  return NextResponse.json({ ok: true });
}
