import type {BatchItem} from "drizzle-orm/batch";
import {visibleResourceFilter} from "@/lib/resource-access";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resources, skillRelations } from "@/db/schema";
import { canCreate, getCurrentUser, writeAudit } from "@/lib/auth";
import { ensureBootstrapData } from "@/lib/bootstrap";
import { readResourceCatalog } from "@/lib/resource-catalog";
import type { ResourceType } from "@/lib/resource-types";
import { isNotifiableResource } from "@/lib/resource-notifications";
import { parseCommonQa, parsePermissions, validateResourceContent, type RelationInput } from "@/lib/resource-input";
import { validWebsiteCategory } from "@/lib/website-category-validation";
import { matchesEtag } from "@/lib/http-cache";

export async function GET(request: Request) {
  const started = performance.now(), actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  if (params.get("refresh") !== "1") await ensureBootstrapData();
  const data = await readResourceCatalog(actor, params.get("summary") === "1");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  const etag = '"' + Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("") + '"';
  const headers = { "Cache-Control": "private, no-cache", "ETag": etag, "Server-Timing": `resources;dur=${(performance.now()-started).toFixed(1)}` };
  return matchesEtag(request.headers.get("if-none-match"), etag) ? new Response(null, { status: 304, headers }) : NextResponse.json(data, { headers });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || !canCreate(actor.role)) return NextResponse.json({ error: "无权创建资源" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  const type = String(body.type ?? "") as ResourceType;
  if (type === "OTHER") { body.summary = String(body.detail ?? "").trim().slice(0,200); body.scenario = String(body.scenario ?? "").trim(); body.slug ||= `other-${crypto.randomUUID()}`; }
  const validationError = validateResourceContent(body, type, true);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  if (type === "INTERNAL" && !await validWebsiteCategory(body.websiteCategoryId, body.scenario)) return NextResponse.json({ error: "网站分类不存在或不属于当前目录" }, { status: 400 });
  if (type === "INTERNAL" && body.scenario === "other_useful") {
    return NextResponse.json({ error: "小组网站请在“其他有用网站”对应小组内添加" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (!name || !summary || !slug || !["SKILL", "MCP", "AGENT", "INTERNAL", "OTHER"].includes(type)) {
    return NextResponse.json({ error: "请填写完整的必填信息" }, { status: 400 });
  }
  if (type === "SKILL" && !body.businessDirection) {
    return NextResponse.json({ error: "Skill 必须选择业务方向" }, { status: 400 });
  }
  if (type === "INTERNAL" && !body.sourceUrl) {
    return NextResponse.json({ error: "内部网站必须填写访问链接" }, { status: 400 });
  }
  if (type === "SKILL") {
    const candidates = await getDb().select({id:resources.id}).from(resources).where(and(eq(resources.type,"SKILL"),visibleResourceFilter(actor)));
    for (const field of ["previousSkillId", "nextSkillId", "relatedSkillId"]) if (body[field] && !candidates.some((item) => item.id === body[field])) return NextResponse.json({ error: "请选择有效的关联 Skill" }, { status: 400 });
    for (const link of (body.relationLinks ?? []) as RelationInput[]) if (!candidates.some((item) => item.id === link.targetId)) return NextResponse.json({ error: "请选择有效的关联 Skill" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const db=getDb();
  const writes:BatchItem<"sqlite">[]=[db.insert(resources).values({
    id,
    type,
    name,
    slug,
    businessDirection: body.businessDirection ? String(body.businessDirection) : null,
    scenario: body.scenario ? String(body.scenario) : null,
    resourceModule: type === "OTHER" ? "other" : body.resourceModule ? body.resourceModule as "dida" | "overseas" | "other" : "overseas",
    summary,
    version: body.version !== undefined ? (String(body.version).trim() || null) : type === "SKILL" ? "1.0.0" : null,
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
    detail: String(body.detail ?? ""),
    installationCommand: body.installationCommand ? String(body.installationCommand) : null,
    usageExample: body.usageExample ? String(body.usageExample) : null,
    usageInstructions: body.usageInstructions ? String(body.usageInstructions) : null,
    documentationUrl: body.documentationUrl ? String(body.documentationUrl) : null,
    referenceUrl: body.referenceUrl ? String(body.referenceUrl) : null,
    commonQa: JSON.stringify(parseCommonQa(body.commonQa)),
    websiteCategoryId: type === "INTERNAL" && body.websiteCategoryId ? String(body.websiteCategoryId) : null,
    implementation: body.implementation ? String(body.implementation) : null,
    caseUrl: body.caseUrl ? String(body.caseUrl) : null,
    contact: body.contact ? String(body.contact) : null,
    installationMode: String(body.installationMode ?? (body.installationCommand ? "required" : "pending")),
    repositoryAccess: String(body.repositoryAccess ?? "none"),
    repositoryInstructions: body.repositoryInstructions ? String(body.repositoryInstructions) : null,
    mcpRequirements: body.mcpRequirements ? String(body.mcpRequirements) : null,
    tablePermissionReason: body.type === "SKILL" && body.tablePermissionReason ? String(body.tablePermissionReason).trim() || null : null,
    dataPermissions: JSON.stringify(parsePermissions(body.dataPermissions)),
    contentRevision: 25,
    notificationRevision: actor.role === "ADMIN" && isNotifiableResource(type) ? 1 : 0,
    notificationKind: "new",
    notificationAt: actor.role === "ADMIN" && isNotifiableResource(type) ? now : null,
    sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
    accessData: body.accessData ? String(body.accessData) : null,
    accessMethod: body.accessMethod ? String(body.accessMethod) : null,
    toolList: JSON.stringify(Array.isArray(body.toolList) ? body.toolList : []),
    toolDescriptions: body.toolDescriptions ? JSON.stringify(body.toolDescriptions) : null,
    knowledgeScope: body.knowledgeScope ? String(body.knowledgeScope) : null,
    ownerId: actor.id,
    status: actor.role === "ADMIN" || type === "INTERNAL" ? "PUBLISHED" : "DRAFT",
    releaseNote: body.releaseNote ? String(body.releaseNote) : null,
    createdAt: now,
    updatedAt: now,
  })];
  if (type === "SKILL" && !Array.isArray(body.relationLinks) && body.previousSkillId) {
    writes.push(db.insert(skillRelations).values({
      id: crypto.randomUUID(), sourceSkillId: String(body.previousSkillId), targetSkillId: id,
      triggerCondition: String(body.previousCondition ?? "建议先完成前置分析"), createdAt: now,
    }));
  }
  if (type === "SKILL" && !Array.isArray(body.relationLinks) && (body.nextSkillId || body.relatedSkillId)) {
    writes.push(db.insert(skillRelations).values({
      id: crypto.randomUUID(), sourceSkillId: id, targetSkillId: String(body.nextSkillId ?? body.relatedSkillId),
      triggerCondition: String(body.nextCondition ?? body.relationCondition ?? "推荐继续使用"), createdAt: now,
    }));
  }
  if (type === "SKILL" && Array.isArray(body.relationLinks)) for (const link of body.relationLinks as RelationInput[]) {
    writes.push(db.insert(skillRelations).values({ id: crypto.randomUUID(), sourceSkillId: link.direction === "before" ? link.targetId : id, targetSkillId: link.direction === "before" ? id : link.targetId, triggerCondition: link.condition || "推荐组合使用", createdAt: now }));
  }
  await db.batch(writes as [BatchItem<"sqlite">,...BatchItem<"sqlite">[]]);
  await writeAudit(actor.id, "CREATE_RESOURCE", "RESOURCE", id, name);
  return NextResponse.json({ id }, { status: 201 });
}
