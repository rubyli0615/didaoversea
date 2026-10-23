"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import type { ResourceView } from "@/lib/resource-types";

export function NotificationCenter({ resources, onOpen, onReadAll }: { resources: ResourceView[]; onOpen: (resource: ResourceView) => void; onReadAll: (items: ResourceView[]) => Promise<void> }) {
  const root = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const unread = resources.filter((item) => item.updateNotice).sort((a, b) => (b.updateNotice?.at ?? 0) - (a.updateNotice?.at ?? 0));
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) root.current.open = false; };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  async function readAll() {
    setBusy(true);
    try { await onReadAll(unread); } finally { setBusy(false); }
  }
  return <details className="notification-center" ref={root} onKeyDown={(event) => { if (event.key === "Escape" && root.current) { root.current.open = false; root.current.querySelector("summary")?.focus(); } }}>
    <summary aria-label="更新通知" title={unread.length ? `更新通知 · ${unread.length} 项未读` : "更新通知"}><Bell size={19} />{unread.length > 0 && <span className="notification-count">{unread.length > 99 ? "99+" : unread.length}</span>}</summary>
    <section className="notification-panel" aria-label="站内更新">
      <header><div><h2>资源更新</h2><span>{unread.length} 项未读</span></div><button type="button" disabled={!unread.length || busy} onClick={readAll}>{busy ? "标记中…" : "全部已读"}</button></header>
      <div className="notification-list">{unread.length ? unread.map((item) => <button className="notification-item" type="button" key={item.id} onClick={() => { if (root.current) root.current.open = false; onOpen(item); }}><span className="notice-dot" /><div><div className="notification-item-meta"><span>{item.updateNotice?.kind === "new" ? "新增" : "更新"} · {item.type === "SKILL" ? "Skill" : item.type === "MCP" ? "MCP" : "Agent"}</span><time>{new Date((item.updateNotice?.at ?? item.updatedAt) * 1000).toLocaleDateString("zh-CN")}</time></div><b>{item.name}</b>{item.releaseNote && <p>{item.releaseNote}</p>}</div><ChevronRight size={15} /></button>) : <div className="notification-empty">暂无未读更新</div>}</div>
      <footer>仅提醒正式发布的 Skill、MCP 和 Agent。在线时约每 30 秒后台同步提醒，不自动刷新当前详情；离线期间的未读会保留。</footer>
    </section>
  </details>;
}
