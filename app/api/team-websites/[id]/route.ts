import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { teamWebsites } from "@/db/schema";
import { getCurrentUser, writeAudit } from "@/lib/auth";
import { canManageTeamWebsites, canEditTeamWebsites, validateWebsiteInput } from "@/lib/team-websites";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const existing = (await db.select().from(teamWebsites).where(eq(teamWebsites.id, id)).limit(1))[0];
  if (!existing) return NextResponse.json({ error: "网站不存在" }, { status: 404 });
  if (!canEditTeamWebsites(actor, existing.teamId)) return NextResponse.json({ error: "仅 Creator、本组组长或管理员可维护网站" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  if (body.teamId !== undefined && body.teamId !== existing.teamId) return NextResponse.json({ error: "不能将网站移至其他组" }, { status: 400 });
  const input = validateWebsiteInput(body);
  if (input.error) return NextResponse.json({ error: input.error }, { status: 400 });
  const peers = await db.select({id:teamWebsites.id}).from(teamWebsites).where(and(eq(teamWebsites.teamId,existing.teamId),eq(teamWebsites.url,input.url!),ne(teamWebsites.id,id))).limit(1);
  if (peers.length) return NextResponse.json({ error: "本组已添加这个网址" }, { status: 409 });
  try {
    await db.update(teamWebsites).set({ name: input.name!, description: input.description!, url: input.url!, updatedBy: actor.id, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(teamWebsites.id, id));
  } catch (error) {
    const detail = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
    if (/unique constraint/i.test(detail)) return NextResponse.json({ error: "本组已添加这个网址" }, { status: 409 });
    throw error;
  }
  await writeAudit(actor.id, "UPDATE_TEAM_WEBSITE", "TEAM_WEBSITE", id, existing.teamId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const existing = (await db.select().from(teamWebsites).where(eq(teamWebsites.id, id)).limit(1))[0];
  if (!existing) return NextResponse.json({ error: "网站不存在" }, { status: 404 });
  if (!canManageTeamWebsites(actor, existing.teamId)) return NextResponse.json({ error: "仅本组组长或管理员可维护网站" }, { status: 403 });
  await db.delete(teamWebsites).where(eq(teamWebsites.id, id));
  await writeAudit(actor.id, "DELETE_TEAM_WEBSITE", "TEAM_WEBSITE", id, existing.teamId);
  return NextResponse.json({ ok: true });
}
