import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { getDb } from "@/db";
import { resourceReads, resources, skillRelations, users } from "@/db/schema";
import {visibleResourceFilter} from "./resource-access";
import type { SafeUser, ResourceView } from "./resource-types";
import { parseCommonQa, parsePermissions } from "./resource-input";
import { isNotifiableResource } from "./resource-notifications";

export function parseList(value: string) { try { const list = JSON.parse(value); return Array.isArray(list) ? list : []; } catch { return []; } }
export function parseToolDescriptions(value: string | null): Record<string, string> { try { const data = JSON.parse(value ?? "{}"); return data && typeof data === "object" && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([, description]) => typeof description === "string")) as Record<string, string> : {}; } catch { return {}; } }
export function resourceView(resource: typeof resources.$inferSelect, ownerName: string, readRevision = 0): ResourceView {
  return { ...resource, ownerName, tags: parseList(resource.tags), toolList: parseList(resource.toolList), toolDescriptions: resource.toolDescriptions === null ? undefined : parseToolDescriptions(resource.toolDescriptions),
    dataPermissions: parsePermissions(parseList(resource.dataPermissions)), commonQa: parseCommonQa(parseList(resource.commonQa)),
    updateNotice: resource.status === "PUBLISHED" && isNotifiableResource(resource.type) && resource.notificationRevision > readRevision ? { revision: resource.notificationRevision, kind: resource.notificationKind, at: resource.notificationAt ?? resource.updatedAt } : null };
}
// Do not ship installation guides, SQL/table lists and long documentation to every card.
const { detail, installationCommand, usageExample, usageInstructions, documentationUrl, referenceUrl, commonQa, implementation, caseUrl, contact, repositoryInstructions, mcpRequirements, tablePermissionReason, dataPermissions, accessData, accessMethod, toolList, toolDescriptions, knowledgeScope, ...summaryColumns } = getTableColumns(resources);
const emptyContent = { detail:"", installationCommand:null, usageExample:null, usageInstructions:null, documentationUrl:null, referenceUrl:null, commonQa:"[]", implementation:null, caseUrl:null, contact:null, repositoryInstructions:null, mcpRequirements:null, tablePermissionReason:null, dataPermissions:"[]", accessData:null, accessMethod:null, toolList:"[]", toolDescriptions:null, knowledgeScope:null };
export async function readResourceCatalog(actor: SafeUser, summary = false) {
  const db = getDb();
  const [rows, relations] = await db.batch([db.select({ resource: summary ? summaryColumns : getTableColumns(resources), ownerName: users.displayName, readRevision: resourceReads.revision }).from(resources)
    .innerJoin(users, eq(resources.ownerId, users.id))
    .leftJoin(resourceReads, and(eq(resourceReads.resourceId, resources.id), eq(resourceReads.userId, actor.id)))
    .where(visibleResourceFilter(actor))
    .orderBy(desc(resources.updatedAt)), db.select().from(skillRelations)]);
  const visibleIds=new Set(rows.map(({resource})=>resource.id));
  return { resources: rows.map(({ resource, ownerName, readRevision }) => {
    const view = resourceView({ ...emptyContent, ...resource } as typeof resources.$inferSelect, ownerName, readRevision ?? 0);
    // Catalog rows intentionally omit detail fields. The isSummary guard loads the full row before detail/edit views.
    return summary ? { ...resource, tags: view.tags, ownerName, updateNotice: view.updateNotice, isSummary: true } as unknown as ResourceView : view;
  }), relations:relations.filter(relation=>visibleIds.has(relation.sourceSkillId)&&visibleIds.has(relation.targetSkillId)) };
}
