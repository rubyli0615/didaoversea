import type { SafeUser } from "./resource-types";

export type WebsiteScenario = "overseas_op" | "ai_tools";
export type WebsiteCategory = { id: string; scenario: string; name: string; sortOrder: number };
export const DEFAULT_WEBSITE_CATEGORIES = [
  { id: "op-data", scenario: "overseas_op", name: "数据相关", sortOrder: 0 },
  { id: "op-static", scenario: "overseas_op", name: "静态相关", sortOrder: 1 },
  { id: "op-api-orders", scenario: "overseas_op", name: "API和订单相关", sortOrder: 2 },
  { id: "op-configuration", scenario: "overseas_op", name: "配置相关", sortOrder: 3 },
  { id: "ai-chat", scenario: "ai_tools", name: "AI聊天", sortOrder: 0 },
  { id: "ai-agent", scenario: "ai_tools", name: "AI Agent", sortOrder: 1 },
  { id: "ai-news", scenario: "ai_tools", name: "AI资讯", sortOrder: 2 },
] as const;
export function isWebsiteScenario(value: unknown): value is WebsiteScenario { return value === "overseas_op" || value === "ai_tools"; }
export function canEditCommonWebsite(actor: Pick<SafeUser, "role" | "active">, resource: { type: string; scenario: string | null }) {
  return actor.active && ["ADMIN", "CREATOR"].includes(actor.role) && resource.type === "INTERNAL" && isWebsiteScenario(resource.scenario);
}
export function suggestedWebsiteCategory(site: { name: string; slug: string; scenario: string | null }) {
  if (site.scenario !== "overseas_op") return null;
  const name = `${site.name} ${site.slug}`.toLowerCase();
  if (/analysis|angrybirds|quickbi/.test(name)) return "op-data";
  if (/content/.test(name)) return "op-static";
  if (/finance|grafana|tiger/.test(name)) return "op-api-orders";
  if (/wolf/.test(name)) return "op-configuration";
  return null;
}
export function categoryNameInput(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 40) return null;
  return { name: value.trim(), nameKey: value.trim().normalize("NFKC").toLowerCase() };
}
