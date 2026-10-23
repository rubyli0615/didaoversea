import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { teamWebsites } from "@/db/schema";
import { getCurrentUser, writeAudit } from "@/lib/auth";
import { canEditTeamWebsites, validateWebsiteInput } from "@/lib/team-websites";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const websites = await getDb().select({ id: teamWebsites.id, teamId: teamWebsites.teamId, name: teamWebsites.name, description: teamWebsites.description, url: teamWebsites.url, updatedAt: teamWebsites.updatedAt }).from(teamWebsites).orderBy(asc(teamWebsites.createdAt), asc(teamWebsites.id));
  return NextResponse.json({ websites }, {headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  const teamId = typeof body.teamId === "string" ? body.teamId : "";
  if (!canEditTeamWebsites(actor, teamId)) return NextResponse.json({ error: "仅 Creator、本组组长或管理员可维护网站" }, { status: 403 });
  const input = validateWebsiteInput(body);
  if (input.error) return NextResponse.json({ error: input.error }, { status: 400 });
  const existing = await getDb().select({id:teamWebsites.id}).from(teamWebsites).where(and(eq(teamWebsites.teamId,teamId),eq(teamWebsites.url,input.url!))).limit(1);
  if (existing.length) return NextResponse.json({ error: "本组已添加这个网址" }, { status: 409 });
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const inserted = await getDb().insert(teamWebsites).values({ id, teamId, name: input.name!, description: input.description!, url: input.url!, createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now }).onConflictDoNothing().returning({ id: teamWebsites.id });
  if (!inserted.length) return NextResponse.json({ error: "本组已添加这个网址" }, { status: 409 });
  await writeAudit(actor.id, "CREATE_TEAM_WEBSITE", "TEAM_WEBSITE", id, teamId);
  return NextResponse.json({ id }, { status: 201 });
}
