import { NextResponse } from "next/server";
import { getCurrentUser, revokeCurrentSession, writeAudit } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  await revokeCurrentSession();
  if (user) await writeAudit(user.id, "LOGOUT", "USER", user.id);
  return NextResponse.json({ ok: true });
}
