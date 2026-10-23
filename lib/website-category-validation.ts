import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { websiteCategories } from "@/db/schema";

export async function validWebsiteCategory(id: unknown, scenario: unknown) {
  if (!id) return true;
  if (typeof id !== "string" || typeof scenario !== "string") return false;
  return Boolean((await getDb().select({ id: websiteCategories.id }).from(websiteCategories).where(and(eq(websiteCategories.id, id), eq(websiteCategories.scenario, scenario))).limit(1))[0]);
}
