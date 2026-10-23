import type { SafeUser } from "./resource-types";

export type ResourceModule = "dida" | "overseas" | "other";
export const RESOURCE_MODULES = { dida: "DIDA AI资源", overseas: "海外渠道资源", other: "其他" } as const;
type ModuleResource = { resourceModule?: string | null; slug: string; businessDirection: string | null; scenario: string | null; tags: string | string[] };
export function getResourceModule(resource: ModuleResource): ResourceModule {
  if (resource.resourceModule === "dida" || resource.resourceModule === "other" || resource.resourceModule === "overseas") return resource.resourceModule;
  if (["tiger-mcp", "data-mcp"].includes(resource.slug)) return "dida";
  let tags: string[] = [];
  try { tags = typeof resource.tags === "string" ? JSON.parse(resource.tags) : resource.tags; } catch {}
  return resource.businessDirection === "other" || resource.scenario === "uncategorized" || tags.includes("其他") ? "other" : "overseas";
}
export function canEditResource(actor: Pick<SafeUser, "id" | "role" | "active">, resource: ModuleResource & { type: string; ownerId: string; status: string }) {
  return actor.active && (actor.role === "ADMIN" || actor.role === "CREATOR" && (
    resource.ownerId === actor.id || resource.status === "PUBLISHED"
  ));
}
