import {sql} from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  const rows = await getDb().select({id:users.id,email:users.email,displayName:users.displayName,role:users.role,active:users.active,hasKey:sql<number>`${users.keyHash} is not null`}).from(users);
  return NextResponse.json({
    users: rows.map((user) => ({
      id: user.id, email: user.email, displayName: user.displayName, role: user.role,
      active: user.active, hasKey: Boolean(user.hasKey),
    })),
  }, {headers:{"Cache-Control":"private, no-store"}});
}
