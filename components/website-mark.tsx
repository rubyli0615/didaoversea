import { websiteInitial } from "@/lib/team-websites";

// Shared by the website overview and the team directory so shortcuts stay consistent.
export function WebsiteShortcutLink({name,url,description}:{name:string;url:string;description?:string|null}) {
  return <a draggable={false} href={url} target="_blank" rel="noopener noreferrer" title={description || "暂无功能说明"}><span className="shortcut-circle" aria-hidden="true">{websiteInitial(name)}</span><b>{name}</b></a>;
}

export function WebsiteMark({ size = 20 }: { size?: number }) {
  return <img className="website-mark" src="/website-mark.png" alt="" width={size} height={size} />;
}

export function WebsiteIcon({ name, scenario }: { name: string; scenario?: string | null }) {
  return scenario === "ai_tools" || scenario === "other_useful" ? <span className="shortcut-circle" aria-hidden="true">{websiteInitial(name)}</span> : <WebsiteMark size={32} />;
}
