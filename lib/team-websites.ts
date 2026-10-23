import type { SafeUser } from "./resource-types";

export const WEBSITE_TEAMS = [
  { id: "ai-project", name: "AI&项目组", lead: "Jason", leadEmail: "jason.huang@dida.com", members: ["Ruby", "Kristine"] },
  { id: "data", name: "数据组", lead: "Lumino", leadEmail: "lumino.zheng@dida.com", members: ["Lea"] },
  { id: "onboarding", name: "新客户上线组", lead: "Banks", leadEmail: "banks.feng@dida.com", members: ["Gloria", "Danny"] },
  { id: "apac-me", name: "亚太中东运营组", lead: "William", leadEmail: "william.xia@dida.com", members: ["Yuki", "Eden", "Carinna", "Yara", "Lily"] },
  { id: "europe-americas", name: "欧美运营组", lead: "Jeffee", leadEmail: "jeffee.jiang@dida.com", members: ["Neo", "Jack", "Hazel", "Iris", "Pollen"] },
  { id: "agoda", name: "Agoda运营组", lead: "Kelly", leadEmail: "kelly.he@dida.com", members: ["Max"] },
] as const;

export type TeamWebsite = { id: string; teamId: string; name: string; description: string; url: string; updatedAt: number };

export function websiteInitial(name: string) { return ([...name.trim()][0] ?? "").toLocaleUpperCase(); }
const websiteNameCollator=new Intl.Collator("zh-CN",{sensitivity:"base",numeric:true});
export function compareWebsiteNames(a: { name: string }, b: { name: string }) {
  return websiteNameCollator.compare(a.name.trim(),b.name.trim());
}

export function isTeamWebsiteLead(actor: Pick<SafeUser, "email" | "active">, teamId: string) {
  return Boolean(actor.active && WEBSITE_TEAMS.some((team) => team.id === teamId && team.leadEmail === actor.email.toLowerCase()));
}

export function canManageTeamWebsites(actor: Pick<SafeUser, "email" | "role" | "active">, teamId: string) {
  const team = WEBSITE_TEAMS.find((item) => item.id === teamId);
  return Boolean(actor.active && team && (actor.role === "ADMIN" || actor.email.toLowerCase() === team.leadEmail));
}

export function validateWebsiteInput(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
    return { error: "请输入网站名称，最多 100 个字符" } as const;
  }
  if (typeof body.description !== "string" || !body.description.trim() || body.description.trim().length > 500) {
    return { error: "请输入网站功能说明，最多 500 个字符" } as const;
  }
  try {
    if (typeof body.url !== "string" || body.url.length > 2048) throw new Error();
    const url = new URL(body.url.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return { name: body.name.trim(), description: body.description.trim(), url: url.href } as const;
  } catch {
    return { error: "请输入完整的 http:// 或 https:// 网址，不包含账号密码" } as const;
  }
}
export function canEditTeamWebsites(actor: Pick<SafeUser, "email" | "role" | "active">, teamId: string) {
  return Boolean(actor.active && WEBSITE_TEAMS.some(team => team.id === teamId) && (actor.role === "CREATOR" || canManageTeamWebsites(actor, teamId)));
}
