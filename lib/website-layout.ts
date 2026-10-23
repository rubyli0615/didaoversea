import type { WebsiteCategory } from "./website-categories";
import {compareWebsiteNames} from "./team-websites";
import type { TeamWebsite } from "./team-websites";
export type WebsiteLayout = { scenario: string; siteIds: string[]; groupIds: string[]; revision: number };
export type DirectoryData = { categories: WebsiteCategory[]; websites: TeamWebsite[]; layouts: WebsiteLayout[] };
export function orderedWebsites<T extends { id: string; name: string }>(items: readonly T[], ids: string[]) {
  const rank = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a,b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || compareWebsiteNames(a,b));
}
