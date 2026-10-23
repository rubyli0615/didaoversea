import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resourceReads, resources, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {visibleResourceFilter} from "@/lib/resource-access";
import { resourceView } from "@/lib/resource-catalog";
export const dynamic = "force-dynamic";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await context.params, db = getDb();
  const row = (await db.select({ resource: resources, ownerName: users.displayName, readRevision: resourceReads.revision }).from(resources)
    .innerJoin(users, eq(resources.ownerId, users.id))
    .leftJoin(resourceReads, and(eq(resourceReads.resourceId, resources.id), eq(resourceReads.userId, actor.id)))
    .where(and(eq(resources.id,id), visibleResourceFilter(actor))).limit(1))[0];
  if (!row || row.resource.status === "ARCHIVED") return NextResponse.json({ error: "资源不存在" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ resource: resourceView(row.resource, row.ownerName, row.readRevision ?? 0) }, { headers: { "Cache-Control": "private, no-store" } });
}
