"use client";

import {
  Activity, ArrowRight, BookOpen, Bot, Boxes, Check, ChevronRight, Clock, Copy, ExternalLink,
  GitBranch, KeyRound, Library, LogOut,
  ArrowLeftToLine, ArrowRightFromLine, Plus, Search, Settings2, ShieldCheck, Sparkles, Users, Wrench, X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BUSINESS_DIRECTIONS, type CatalogData, type ResourceView, type SafeUser, type SkillRelationView } from "@/lib/resource-types";
import { getResourceModule, RESOURCE_MODULES, type ResourceModule } from "@/lib/resource-modules";
import { loadWebsiteDirectories, clearWebsiteDirectories } from "@/lib/website-directory-client";
import { teamWebsiteResource } from "@/lib/team-website-resource";
import { compareWebsiteNames, type TeamWebsite } from "@/lib/team-websites";
import { formatLoginAccount } from "@/lib/login-account";
import { PageErrorBoundary } from "@/components/page-error-boundary";
import { NotificationCenter } from "@/components/notification-center";
import {api} from "@/lib/client-api";
import {LoginForm} from "@/components/login-form";
import {BrandLogo} from "@/components/brand-logo";
const CommonWebsites = lazy(() => import("@/components/team-websites").then(module => ({ default: module.CommonWebsites })));
const TeamWebsites = lazy(() => import("@/components/team-websites").then(module => ({ default: module.TeamWebsites })));
const ResourceDetail = lazy(() => import("@/components/resource-detail").then(module => ({ default: module.ResourceDetail })));
const ResourceEditor = lazy(() => import("@/components/resource-editor").then(module => ({ default: module.ResourceEditor })));
const OtherResourceEditor = lazy(() => import("@/components/other-resource-editor").then(module => ({ default: module.OtherResourceEditor })));
import { WebsiteIcon, WebsiteMark, WebsiteShortcutLink } from "@/components/website-mark";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { addWorkspaceTab, MAX_OPEN_TABS, type ViewId, type WorkspaceTab } from "@/lib/workspace-tabs";

type UserWithKey = SafeUser & { hasKey: boolean };
const TYPE_META = {
  SKILL: { label: "Skill", icon: GitBranch, tone: "coral" },
  MCP: { label: "MCP", icon: Boxes, tone: "coral" },
  AGENT: { label: "Agent", icon: Sparkles, tone: "blue" },
  OTHER: { label: "其他资源", icon: Wrench, tone: "blue" },
  INTERNAL: { label: "内部网站", icon: WebsiteMark, tone: "green" },
} as const;
const DIRECTION_COLOR: Record<string, string> = {
  resource_optimization: "#000846", enhanced_matching: "#dc2450",
  technical_operations: "#304d8a", exposure_expansion: "#b91c40",
};
const VIEW_LABELS: Record<ViewId, string> = {
  home: "资源总览", map: "四支柱业务地图", all: "工作台总览", SKILL: "Skills",
  MCP: "MCP", AGENT: "Agent", INTERNAL: "网站", OTHER: "其他", updates: "更新动态",
  mine: "我的资源", guide: "使用指南", admin: "账号管理",
};
const ROLE_LABELS = { ADMIN: "资源管理员", CREATOR: "资源创建者", VIEWER: "资源查看者" } as const;


export function WorkspaceApp({ initialUser, initialCatalog }: { initialUser: SafeUser | null; initialCatalog: CatalogData }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const [user, setUser] = useState<SafeUser | null>(initialUser);
  const [resources, setResources] = useState<ResourceView[]>(initialCatalog.resources);
  const [relations, setRelations] = useState<SkillRelationView[]>(initialCatalog.relations);
  const [view, setView] = useState<ViewId>("all");
  const [scope, setScope] = useState("all");
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>([{ id: "all", label: "工作台总览", view: "all", scope: "all" }]);
  const [activeTabId, setActiveTabId] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ResourceView | null>(null);
  const [editing, setEditing] = useState<ResourceView | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [teamResources, setTeamResources] = useState<ResourceView[]>([]);
  const [teamCatalogError, setTeamCatalogError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const readRevisions = useRef({ userId: initialUser?.id ?? "", values: new Map<string, number>() });
  const preloadedFor = useRef(initialUser?.id ?? "");
  const catalogCache = useRef({ etag: "", data: initialCatalog });
  const detailCache = useRef(new Map<string, ResourceView>());
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const pendingResources = useRef<{userId:string;promise:Promise<CatalogData>}|null>(null);
  const deferredCatalog = useRef<{userId:string;data:CatalogData}|null>(null);
  const formOpen = useRef(false);formOpen.current=Boolean(editing||showCreate);
  const restoredFor = useRef("");
  const restoreY = useRef<number | null>(null);
  const navigationSnapshot = useRef("");
  const navigationReady = useRef(false);
  useEffect(() => {
    if (!user || restoredFor.current === user.id) return;
    restoredFor.current = user.id; navigationReady.current = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem("dida-workspace:"+user.id) ?? "null");
      if (saved && Array.isArray(saved.tabs)) {
        const staticTabs: Record<string,WorkspaceTab> = Object.fromEntries((Object.keys(VIEW_LABELS) as ViewId[]).filter(id=>id!=="admin"||user.role==="ADMIN").map(id=>[id,{id,label:VIEW_LABELS[id],view:id,scope:id}]));
        for (const [id,label] of [["dida","DIDA AI资源"],["overseas","海外渠道资源"],["other","其他"]]) staticTabs[id==="other"?"other":"section-"+id]={id:id==="other"?"other":"section-"+id,label,view:"all",scope:id};
        for (const [id,label,view,scope] of [["overseas-mcp","MCP","MCP","overseas-mcp"],["website-op","海外OP常用网站","INTERNAL","website-op"],["website-ai","AI常用网站","INTERNAL","website-ai"],["website-other","其他有用网站","INTERNAL","website-other"]]) staticTabs[id]={id,label,view:view as ViewId,scope};
        for(const module of Object.keys(RESOURCE_MODULES) as ResourceModule[]) for(const type of ["SKILL","MCP","AGENT","INTERNAL","OTHER"] as ViewId[]) {
          const id="type-"+module+"-"+type;staticTabs[id]={id,label:VIEW_LABELS[type],view:type,scope:module};
        }
        const restored:WorkspaceTab[]=[];
        for (const item of saved.tabs.slice(0,MAX_OPEN_TABS)) {
          if (!item || typeof item.id!=="string" || restored.some(tab=>tab.id===item.id)) continue;
          const resource=resources.find(resource=>"resource:"+resource.id===item.id);
          const tab=resource?{id:item.id,label:resource.name,view:resource.type,scope:resource.type,resourceId:resource.id}:Object.hasOwn(staticTabs,item.id)?staticTabs[item.id]:undefined;
          if (tab) restored.push(tab);
        }
        const active=restored.find(tab=>tab.id===saved.activeId)??restored[0];
        if (active) {
          setOpenTabs(restored);setActiveTabId(active.id);setView(active.view);setScope(active.scope??active.id);
          setSelected(active.resourceId?resources.find(item=>item.id===active.resourceId)??null:null);
          setQuery(typeof saved.query==="string"?saved.query.slice(0,300):"");
          setSidebarCollapsed(saved.sidebarCollapsed===true);
          restoreY.current=Number.isFinite(saved.y)?Math.max(0,Math.min(saved.y,100000)):0;
        }
      }
    } catch { /* Storage is optional; a blocked or old snapshot must not block login. */ }
    navigationReady.current=true;
  },[user?.id]);
  navigationSnapshot.current=JSON.stringify({tabs:openTabs.map(tab=>({id:tab.id})),activeId:activeTabId,query,sidebarCollapsed});
  useEffect(()=>{
    if(!user)return;
    let timer=0;
    const save=()=>{
      if(!navigationReady.current||restoredFor.current!==user.id||restoreY.current!==null)return;
      try { sessionStorage.setItem("dida-workspace:"+user.id,JSON.stringify({...JSON.parse(navigationSnapshot.current),y:window.scrollY})); } catch { /* Browser storage may be disabled. */ }
    };
    const scroll=()=>{clearTimeout(timer);timer=window.setTimeout(save,200);};
    window.addEventListener("pagehide",save);window.addEventListener("scroll",scroll,{passive:true});
    return()=>{clearTimeout(timer);window.removeEventListener("pagehide",save);window.removeEventListener("scroll",scroll);};
  },[user?.id]);
  useEffect(()=>{
    if(!user||!hydrated||!navigationReady.current)return;
    if(restoreY.current!==null) {
      const target=restoreY.current;
      const stop=()=>{restoreY.current=null;observer.disconnect();clearTimeout(timeout);window.removeEventListener("wheel",stop);window.removeEventListener("touchstart",stop);window.removeEventListener("keydown",stop);};
      const restore=()=>{if(restoreY.current===null)return;if(document.documentElement.scrollHeight-window.innerHeight>=target&&!selected?.isSummary){window.scrollTo(0,target);stop();}};
      const observer=new ResizeObserver(restore),timeout=window.setTimeout(stop,8000);
      observer.observe(document.documentElement);window.addEventListener("wheel",stop,{passive:true});window.addEventListener("touchstart",stop,{passive:true});window.addEventListener("keydown",stop);
      requestAnimationFrame(restore);
      return()=>{observer.disconnect();clearTimeout(timeout);window.removeEventListener("wheel",stop);window.removeEventListener("touchstart",stop);window.removeEventListener("keydown",stop);};
    }
    try {sessionStorage.setItem("dida-workspace:"+user.id,JSON.stringify({...JSON.parse(navigationSnapshot.current),y:window.scrollY}));}catch{}
  },[user?.id,hydrated,openTabs,activeTabId,query,sidebarCollapsed,selected?.isSummary]);

  useEffect(() => {
    if (!user) return;
    readRevisions.current = { userId: user.id, values: new Map() };
    let live = true;
    let initialized = preloadedFor.current === user.id;
    let failures = 0, nextAttemptAt = 0;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false || formOpen.current || Date.now() < nextAttemptAt) return;
      try {
        const data = await resourceData(initialized);
        if (!live) return;
        failures = 0; nextAttemptAt = 0; initialized = true;
        if (formOpen.current) { if (!data.notModified) deferredCatalog.current={userId:user.id,data}; return; }
        if (data.notModified) return;
        setResources(applyLocalReads(data.resources)); setRelations(data.relations);
        // Background catalogs contain summaries, never replace or unmount an open detail.
      } catch { if (live) { failures++; nextAttemptAt = Date.now() + Math.min(300000, 30000 * 2 ** Math.min(failures, 4)); if (failures === 1) setNotice("后台更新暂不可用，当前内容已保留，稍后自动重试"); } }
    };
    if (!initialized) void refresh();
    const timer = window.setInterval(refresh, 30000);
    const reconnect = () => { nextAttemptAt = 0; void refresh(); };
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; window.removeEventListener("online", reconnect); window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [user?.id]);
  useEffect(() => {
    if (editing || showCreate) return;
    const deferred=deferredCatalog.current; deferredCatalog.current=null;
    if (deferred && deferred.userId===user?.id) { setResources(applyLocalReads(deferred.data.resources));setRelations(deferred.data.relations); }
  }, [editing,showCreate,user?.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  function applyLocalReads(items: ResourceView[]) {
    const read=(item:ResourceView)=>item.updateNotice && item.updateNotice.revision <= (readRevisions.current.values.get(item.id)??0);
    return items.some(read)?items.map(item=>read(item)?{...item,updateNotice:null}:item):items;
  }
  function resourceData(refresh=true, force=false) {
    const userId=user!.id;
    if(pendingResources.current?.userId===userId)return pendingResources.current.promise;
    const promise=(async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
      const response = await fetch("/api/resources"+(refresh?"?refresh=1&summary=1":"?summary=1"), { cache:"no-store", signal:controller.signal, headers: !force && catalogCache.current.etag ? {"If-None-Match":catalogCache.current.etag} : {} });
      if(response.status===304)return {...catalogCache.current.data,notModified:true};
      const data = await response.json() as CatalogData & {error?:string};
      if(!response.ok)throw Error(data.error||"资源加载失败");
      if(!Array.isArray(data.resources)||!Array.isArray(data.relations))throw Error("目录数据格式异常");
      const unchanged = JSON.stringify(data) === JSON.stringify(catalogCache.current.data);
      if(readRevisions.current.userId===userId)catalogCache.current={etag:response.headers.get("etag")??"",data};
      return !force && unchanged ? {...data,notModified:true} : data;
      } finally { window.clearTimeout(timeout); }
    })().finally(()=>{if(pendingResources.current?.promise===promise)pendingResources.current=null;});
    pendingResources.current={userId,promise};return promise;
  }
  async function loadResources() {
    const actorId = user?.id;
    if(!actorId||readRevisions.current.userId!==actorId)return;
    const pending=pendingResources.current;
    if(pending?.userId===actorId)await pending.promise.catch(()=>null);
    const data = await resourceData(true, true);
    if (readRevisions.current.userId !== actorId) return;
    deferredCatalog.current=null;
    setResources(applyLocalReads(data.resources)); setRelations(data.relations);
    return data.resources;
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    clearWebsiteDirectories(user?.id); navigationReady.current=false; restoredFor.current="";restoreY.current=null;
    try{sessionStorage.removeItem("dida-workspace:"+user?.id);}catch{}
    readRevisions.current = { userId: "", values: new Map() };
    pendingResources.current=null;deferredCatalog.current=null;preloadedFor.current="";detailCache.current.clear();catalogCache.current={etag:"",data:{resources:[],relations:[]}};
    setTeamResources([]);setTeamCatalogError("");
    setUser(null); setResources([]); setRelations([]); setSelected(null); setEditing(null); setShowCreate(false);
    setView("all"); setScope("all"); setOpenTabs([{ id: "all", label: "工作台总览", view: "all", scope: "all" }]); setActiveTabId("all");
  }
  async function markUpdatesRead(items: ResourceView[]) {
    const actorId = user?.id;
    const observed = items.filter((item) => item.updateNotice).map((item) => ({ resourceId: item.id, revision: item.updateNotice!.revision }));
    if (!observed.length) return;
    try {
      for (let offset = 0; offset < observed.length; offset += 100) await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ items: observed.slice(offset, offset + 100) }) });
      if (readRevisions.current.userId !== actorId) return;
      for (const item of observed) readRevisions.current.values.set(item.resourceId, Math.max(item.revision, readRevisions.current.values.get(item.resourceId) ?? 0));
      const revisions = new Map(observed.map((item) => [item.resourceId, item.revision]));
      setResources((current) => current.map((item) => item.updateNotice && item.updateNotice.revision <= (revisions.get(item.id) ?? 0) ? { ...item, updateNotice: null } : item));
    } catch { setNotice("已读状态保存失败，请稍后重试"); }
  }

  function activateTab(tab: WorkspaceTab) {
    if (tab.id === activeTabId && !editing && !showCreate) return;
    restoreY.current=null;
    window.scrollTo(0, 0);
    setQuery("");
    setActiveTabId(tab.id); setView(tab.view); setScope(tab.scope ?? tab.id); setEditing(null); setShowCreate(false);
    const resource = tab.resourceId ? resources.find((resource) => resource.id === tab.resourceId) ?? null : null;
    const cached = resource ? detailCache.current.get(resource.id) : null;
    setSelected(cached && resource && cached.contentRevision === resource.contentRevision && cached.updatedAt === resource.updatedAt ? {...cached,updateNotice:resource.updateNotice} : resource);
    if (resource?.updateNotice) void markUpdatesRead([resource]);
  }
  function openPage(tab: WorkspaceTab) {
    if(!openTabs.some(item=>item.id===tab.id)&&openTabs.length>=MAX_OPEN_TABS)setNotice(`最多保留 ${MAX_OPEN_TABS} 个页面，已关闭较早打开的页面`);
    setOpenTabs(current=>addWorkspaceTab(current,tab,activeTabId));
    activateTab(tab);
  }
  function navigateView(next: ViewId) {
    openPage({ id: next, label: VIEW_LABELS[next], view: next, scope: next });
  }
  function openScopedPage(id: string, label: string, next: ViewId, nextScope: string) {
    openPage({ id, label, view: next, scope: nextScope });
  }
  function openResource(resource: ResourceView) {
    if (activeTabId === `resource:${resource.id}` && selected?.id === resource.id && (selected.contentRevision !== resource.contentRevision || selected.updatedAt !== resource.updatedAt)) {
      detailCache.current.delete(resource.id); setSelected(resource); window.scrollTo(0,0);
      if (resource.updateNotice) void markUpdatesRead([resource]); return;
    }
    openPage({ id: `resource:${resource.id}`, label: resource.name, view: resource.type, scope: resource.type, resourceId: resource.id });
  }
  function closeTabs(ids:string[]) {
    if((editing||showCreate)&&ids.includes(activeTabId)&&!confirm("当前表单尚未保存，确定关闭页面吗？"))return;
    const index=openTabs.findIndex(tab=>tab.id===activeTabId);
    const remaining=openTabs.filter(tab=>!ids.includes(tab.id));setOpenTabs(remaining);
    if(ids.includes(activeTabId)){
      const next=remaining[Math.max(0,Math.min(index-1,remaining.length-1))]??remaining[0];
      if(next)activateTab(next);
      else{setActiveTabId("");setSelected(null);setEditing(null);setShowCreate(false);setView("all");setScope("all");setQuery("");}
    }
  }
  function closeTab(id:string){closeTabs([id]);}

  useEffect(() => {
    if (!["overseas", "INTERNAL"].includes(scope) || !user) return;
    let active = true;
    setTeamCatalogError("");
    loadWebsiteDirectories(user.id).then(result => { if(active) setTeamResources(result.websites.map(teamWebsiteResource)); }).catch(() => { if(active) setTeamCatalogError("小组网站加载失败，请重新进入本模块重试。"); });
    return () => { active = false; };
  }, [scope, user?.id]);

  useEffect(() => {
    if (!selected?.isSummary || !user) return;
    const resource = selected, actorId = user.id;
    const cached = detailCache.current.get(resource.id);
    if (cached && cached.contentRevision === resource.contentRevision && cached.updatedAt === resource.updatedAt) {
      setSelected({...cached,updateNotice:resource.updateNotice});return;
    }
    let active = true;const controller=new AbortController();setDetailError("");
    api<{resource:ResourceView}>(`/api/resources/${resource.id}/detail`,{signal:controller.signal}).then(data => {
      if(!active || readRevisions.current.userId!==actorId)return;
      detailCache.current.set(resource.id,data.resource);
      setSelected(current=>current?.id===resource.id?{...data.resource,updateNotice:current.updateNotice}:current);
    }).catch(error=>{if(active)setDetailError(error.message);});
    return () => {active=false;controller.abort();};
  }, [selected?.id, selected?.isSummary, selected?.contentRevision, detailRetry, user?.id]);

  if (!user) return <LoginForm ready={hydrated} onSuccess={(actor,catalog) => { preloadedFor.current=actor.id;catalogCache.current={etag:"",data:catalog};setResources(catalog.resources);setRelations(catalog.relations);setUser(actor); }} />;
  const latestSelected = selected ? resources.find(item => item.id === selected.id) : undefined;
  const selectedHasUpdate = selected && !selected.isSummary && latestSelected && (selected.contentRevision !== latestSelected.contentRevision || selected.updatedAt !== latestSelected.updatedAt);
  const canCreate = user.role === "ADMIN" || user.role === "CREATOR";
  const filtered = (["overseas", "INTERNAL"].includes(scope) ? [...resources, ...teamResources] : resources).filter((resource) => {
    const typeMatch = ["SKILL", "MCP", "AGENT", "INTERNAL", "OTHER"].includes(view) ? resource.type === view : true;
    const mineMatch = view === "mine" ? resource.ownerId === user.id && resource.type !== "INTERNAL" : true;
    const scopeMatch = scope === "overseas-mcp" ? resource.type === "MCP" && getResourceModule(resource) === "overseas"
      : scope === "website-op" ? resource.type === "INTERNAL" && (resource.scenario === "overseas_op" || ["angrybirds", "analysis", "content", "tiger-v2", "wolf-v1", "wolf-v2", "quickbi"].includes(resource.slug))
      : scope === "website-ai" ? resource.type === "INTERNAL" && resource.scenario === "ai_tools"
      : scope === "website-other" ? resource.type === "INTERNAL" && resource.scenario === "other_useful"
      : ["dida", "overseas", "other"].includes(scope) ? getResourceModule(resource) === scope
      : true;
    const q = query.toLowerCase();
    return typeMatch && mineMatch && scopeMatch && (!q || `${resource.name} ${resource.summary} ${resource.tags.join(" ")} ${resource.ownerName}`.toLowerCase().includes(q));
  });

  return <div className={`workspace-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`} inert={!hydrated} aria-busy={!hydrated}>
    <Sidebar user={user} activeTabId={activeTabId} resources={resources} onOpenView={navigateView} onOpenScoped={openScopedPage} onOpenResource={openResource} onLogout={logout} />
    <main className="workspace-main">
      <header className="workspace-header"><button className="sidebar-toggle" aria-label={sidebarCollapsed ? "展开导航栏" : "收起导航栏"} title={sidebarCollapsed ? "展开导航栏" : "收起导航栏"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((current) => !current)}>{sidebarCollapsed ? <ArrowRightFromLine size={21} strokeWidth={1.8} /> : <ArrowLeftToLine size={21} strokeWidth={1.8} />}</button><WorkspaceTabs tabs={openTabs} activeId={activeTabId} onActivate={activateTab} onCloseMany={closeTabs} /><div className="topbar-actions"><NotificationCenter resources={resources} onOpen={openResource} onReadAll={markUpdatesRead} /><span className="environment-pill"><i />团队内部</span>{user.role === "ADMIN" && <button className="topbar-icon" aria-label="账号管理" title="账号管理" onClick={() => navigateView("admin")}><Settings2 size={17} /></button>}</div></header>
      <section className="page-canvas">
        {(selected || ["map", "admin", "guide", "updates"].includes(view)) && <div className="page-breadcrumb"><TopbarTrail view={view} showCreate={showCreate} selected={selected} editing={editing} onOpenScoped={openScopedPage} onNavigate={navigateView} /></div>}
        {selected && !selected.isSummary && !latestSelected && <div className="resource-live-update" role="status"><span>此资源已不在最新目录中，可能已下架或访问权限已变更。</span><button className="secondary-button" onClick={()=>navigateView(selected.type)}>返回目录</button></div>}
        {selectedHasUpdate && <div className="resource-live-update" role="status"><span>此资源已有更新，当前阅读位置和展开状态已保留。</span><button className="secondary-button" onClick={()=>{if(latestSelected){detailCache.current.delete(latestSelected.id);setSelected(latestSelected);void markUpdatesRead([latestSelected]);window.scrollTo(0,0);}}}>载入最新内容</button></div>}
        <PageErrorBoundary resetKey={`${activeTabId}:${editing?.id ?? (showCreate ? "create" : "read")}`} onBack={()=>navigateView("all")}>
        <Suspense fallback={<div className="detail-loading" role="status">正在打开…</div>}>
        {selected?.isSummary ? <div className="detail-loading"><h1>{selected.name}</h1>{detailError ? <><p role="alert">{detailError}</p><button className="secondary-button" onClick={() => setDetailRetry(value=>value+1)}>重试</button></> : <p role="status">正在读取详情…</p>}</div> : selected ? <ResourceDetail key={selected.id} resource={selected} resources={resources} relations={relations} user={user} onSelect={openResource} onEdit={() => { setEditing(selected); setSelected(null); }} onDeleted={async () => { closeTab(activeTabId); await loadResources(); setNotice("资源已删除"); }} />
          : editing?.type === "OTHER" ? <OtherResourceEditor resource={editing} resources={resources} user={user} onClose={() => {setSelected(editing);setEditing(null);}} onSaved={async()=>{const updated=await loadResources();setSelected(updated?.find(item=>item.id===editing.id)??editing);setEditing(null);setNotice("资源已更新");}} />
          : editing ? <ResourceEditor resource={editing} resources={resources} relations={relations} user={user} onClose={() => { setSelected(editing); setEditing(null); }} onSaved={async () => { const updated = await loadResources(); setSelected(updated?.find(item => item.id === editing.id) ?? editing); setEditing(null); setNotice("资源已更新"); }} />
          : showCreate && scope === "other" ? <OtherResourceEditor resources={resources} user={user} onClose={()=>setShowCreate(false)} onSaved={async()=>{setShowCreate(false);await loadResources();setNotice("资源已保存");}} />
          : showCreate ? <ResourceEditor defaultType={["SKILL","MCP","AGENT"].includes(view) ? view as "SKILL"|"MCP"|"AGENT" : "SKILL"} defaultModule={["dida", "overseas", "other"].includes(scope) ? scope as ResourceModule : "overseas"} resources={resources} relations={relations} user={user} onClose={() => setShowCreate(false)} onSaved={async () => { setShowCreate(false); await loadResources(); setNotice("资源已保存"); }} />
          : <>
            {["overseas", "INTERNAL"].includes(scope) && teamCatalogError && <div className="form-error" role="alert">{teamCatalogError}</div>}
            {view === "home" && <HomeView resources={resources} relations={relations} onSelect={openResource} setView={navigateView} />}
            {view === "map" && <CapabilityMap resources={resources} onSelect={openResource} onBack={() => navigateView("SKILL")} />}
            {view === "updates" && <UpdatesView resources={resources} onSelect={openResource} />}
            {view === "guide" && <GuideView user={user} setView={navigateView} />}
            {view === "admin" && user.role === "ADMIN" && <AdminView setNotice={setNotice} />}
            {scope === "website-other" ? <TeamWebsites user={user} legacySites={filtered} /> : scope === "website-op" || scope === "website-ai" ? <CommonWebsites key={scope} user={user} resources={filtered} scenario={scope === "website-op" ? "overseas_op" : "ai_tools"} onChanged={async () => { await loadResources(); }} /> : !["home", "map", "updates", "guide", "admin"].includes(view) && <CatalogView view={view} scope={scope} resources={filtered} relations={relations} query={query} setQuery={setQuery} setView={navigateView} onSelect={openResource} onDirectory={(id,label)=>openScopedPage(id,label,"INTERNAL",id)} canCreate={canCreate} onCreate={() => { window.scrollTo(0, 0); setEditing(null); setShowCreate(true); }} />}
          </>}
        </Suspense>
        </PageErrorBoundary>
      </section>
    </main>
    {notice && <div className="toast">{notice}</div>}
  </div>;
}


function TopbarTrail({ view, showCreate, selected, editing, onNavigate, onOpenScoped }: { onOpenScoped:(id:string,label:string,view:ViewId,scope:string)=>void; view: ViewId; showCreate: boolean; selected: ResourceView | null; editing: ResourceView | null; onNavigate: (view: ViewId) => void }) {
  const isResourceChild = ["SKILL", "MCP", "AGENT", "INTERNAL", "OTHER"].includes(view);
  const typeLabel = selected?.type === "SKILL" ? "Skills" : selected?.type === "MCP" ? "MCP" : selected?.type === "AGENT" ? "Agent" : selected?.type === "OTHER" ? "其他资源" : "内部网站";
  if (selected) {
    const module=getResourceModule(selected), moduleLabel=RESOURCE_MODULES[module];
    const name=selected.slug==="tiger-mcp"?"Tiger MCP":selected.slug==="data-mcp"?"Data MCP":selected.name;
    return <div className="current-view"><button className="breadcrumb-link" onClick={()=>onOpenScoped(module==="other"?"other":"section-"+module,moduleLabel,"all",module)}>{moduleLabel}</button><ChevronRight size={15}/>{module!=="dida"&&<><button className="breadcrumb-link" onClick={()=>onOpenScoped("type-"+module+"-"+selected.type,typeLabel,selected.type,module)}>{typeLabel}</button><ChevronRight size={15}/></>}<strong>{name}</strong></div>;
  }
  if (editing) return <div className="current-view"><span>我的资源</span><ChevronRight size={15} /><strong>编辑资源</strong></div>;
  if (showCreate) return <div className="current-view"><strong>发布资源</strong></div>;
  if (view === "map") return <div className="current-view"><button className="breadcrumb-link" onClick={() => onNavigate("SKILL")}>Skills</button><ChevronRight size={15} /><strong>四支柱业务地图</strong></div>;
  if (isResourceChild || view === "all") return <div className="current-view current-view-placeholder" aria-hidden="true" />;
  return <div className="current-view"><strong>{VIEW_LABELS[view]}</strong></div>;
}



function Sidebar({ user, activeTabId, resources, onOpenView, onOpenScoped, onOpenResource, onLogout }: { user: SafeUser; activeTabId: string; resources: ResourceView[]; onOpenView: (v: ViewId) => void; onOpenScoped: (id: string, label: string, view: ViewId, scope: string) => void; onOpenResource: (resource: ResourceView) => void; onLogout: () => void }) {
  const [groups, setGroups] = useState({ dida: true, overseas: true, agent: false, website: true });
  const toggle = (key: keyof typeof groups) => setGroups((current) => ({ ...current, [key]: !current[key] }));
  const activeResourceType = resources.find((item) => `resource:${item.id}` === activeTabId)?.type;
  const resourceReady = (slug: string) => resources.some((item) => item.slug === slug);
  const openBySlug = (slug: string) => { const resource = resources.find((item) => item.slug === slug); if (resource) onOpenResource(resource); };
  return <aside className="sidebar">
    <button className="sidebar-brand brand-home" aria-label="返回工作台总览" onClick={() => onOpenView("all")}><BrandLogo /><span>海外渠道AI资源工作台</span></button>
    <nav className="nav-section hierarchy-nav" aria-label="资源分类">
      <div className="nav-group">
        <div className={`nav-parent-row${activeTabId === "section-dida" ? " active" : ""}`}><button className="nav-parent" onClick={() => onOpenScoped("section-dida", "DIDA AI资源", "all", "dida")}><span>DIDA AI资源</span></button><button className="nav-disclosure" aria-label="展开或收起 DIDA AI资源" aria-expanded={groups.dida} onClick={() => toggle("dida")}><ChevronRight className={groups.dida ? "expanded" : ""} size={14} /></button></div>
        {groups.dida && <div className="nav-children">
          <button className={activeTabId === "resource:mcp-tiger" ? "active" : ""} disabled={!resourceReady("tiger-mcp")} onClick={() => openBySlug("tiger-mcp")}><span>Tiger MCP</span></button>
          <button className={activeTabId === "resource:mcp-data" ? "active" : ""} disabled={!resourceReady("data-mcp")} onClick={() => openBySlug("data-mcp")}><span>Data MCP</span></button>
        </div>}
      </div>
      <div className="nav-group">
        <div className={`nav-parent-row${activeTabId === "section-overseas" ? " active" : ""}`}><button className="nav-parent" onClick={() => onOpenScoped("section-overseas", "海外渠道资源", "all", "overseas")}><span>海外渠道资源</span></button><button className="nav-disclosure" aria-label="展开或收起 海外渠道资源" aria-expanded={groups.overseas} onClick={() => toggle("overseas")}><ChevronRight className={groups.overseas ? "expanded" : ""} size={14} /></button></div>
        {groups.overseas && <div className="nav-children">
          <button className={activeTabId === "SKILL" ? "active" : ""} onClick={() => onOpenView("SKILL")}><span>Skills</span></button>
          <button className={activeTabId === "MCP" ? "active" : ""} onClick={() => onOpenView("MCP")}><span>MCP</span></button>
          <div className="nav-subgroup">
            <div className="nav-type-row" data-selected={activeTabId === "AGENT" || activeResourceType === "AGENT"}><button className="nav-type-link" onClick={() => onOpenView("AGENT")}>Agent</button><button className="nav-disclosure" aria-label="展开或收起 Agent" aria-expanded={groups.agent} onClick={() => toggle("agent")}><ChevronRight className={groups.agent ? "expanded" : ""} size={14} /></button></div>
            {groups.agent && <div className="nav-grandchildren">
              <button className={activeTabId === "resource:agent-dida-api" ? "active" : ""} disabled={!resourceReady("dida-api-assistant")} onClick={() => openBySlug("dida-api-assistant")}>Dida API内部小助手</button>
              <button className={activeTabId === "resource:agent-sponge" ? "active" : ""} disabled={!resourceReady("sponge-assistant")} onClick={() => openBySlug("sponge-assistant")}>Sponge问答小助手</button>
            </div>}
          </div>
          <div className="nav-subgroup">
            <div className="nav-type-row" data-selected={["INTERNAL", "website-op", "website-ai", "website-other"].includes(activeTabId)}><button className="nav-type-link" onClick={() => onOpenView("INTERNAL")}>网站</button><button className="nav-disclosure" aria-label="展开或收起 网站" aria-expanded={groups.website} onClick={() => toggle("website")}><ChevronRight className={groups.website ? "expanded" : ""} size={14} /></button></div>
            {groups.website && <div className="nav-grandchildren">
              <button className={activeTabId === "website-op" ? "active" : ""} onClick={() => onOpenScoped("website-op", "海外OP常用网站", "INTERNAL", "website-op")}>海外OP常用网站</button>
              <button className={activeTabId === "website-ai" ? "active" : ""} onClick={() => onOpenScoped("website-ai", "AI常用网站", "INTERNAL", "website-ai")}>AI常用网站</button>
              <button className={activeTabId === "website-other" ? "active" : ""} onClick={() => onOpenScoped("website-other", "其他有用网站", "INTERNAL", "website-other")}>其他有用网站</button>
            </div>}
          </div>
        </div>}
      </div>
      <div className="nav-group nav-root-links">
        <button className={`nav-parent nav-leaf${activeTabId === "other" ? " active" : ""}`} onClick={() => onOpenScoped("other", "其他", "all", "other")}><span>其他</span></button>
        {user.role !== "VIEWER" && <button className={`nav-parent nav-leaf${activeTabId === "mine" ? " active" : ""}`} onClick={() => onOpenView("mine")}><span>我创建的</span></button>}
      </div>
    </nav>
    <div className="user-card"><div className="avatar">{user.displayName.slice(0, 1)}</div><div><b>{user.displayName}</b><span>{ROLE_LABELS[user.role]}</span></div><button aria-label="退出登录" title="退出登录" onClick={onLogout}><LogOut size={17} /></button></div>
  </aside>;
}

function HomeView({ resources, relations, onSelect, setView }: { resources: ResourceView[]; relations: SkillRelationView[]; onSelect: (r: ResourceView) => void; setView: (v: ViewId) => void }) {
  const counts = { SKILL: 0, MCP: 0, AGENT: 0, INTERNAL: 0, OTHER: 0 };
  resources.filter((r) => r.status === "PUBLISHED").forEach((r) => counts[r.type]++);
  return <><section className="hero"><div className="hero-copy"><span className="eyebrow light">DIDA OVERSEAS AI RESOURCE HUB</span><h1>把好方法沉淀下来，<br />让团队更快找到答案。</h1><p>统一发现、理解和复用 Skill、MCP、Agent 与内部网站，让分散的个人经验成为可持续更新的团队资源。</p><div className="hero-tags"><span><ShieldCheck size={14} />按角色安全访问</span><span><GitBranch size={14} />关联推荐路径</span><span><Activity size={14} />版本持续更新</span></div></div><div className="hero-diagram"><div className="hero-node"><Sparkles size={24} /><span>发现问题</span></div><b>+</b><div className="hero-node"><Library size={24} /><span>找到资源</span></div><ArrowRight size={20} /><div className="hero-node"><Bot size={24} /><span>组合使用</span></div></div></section><div className="metrics">{Object.entries(counts).map(([type, count]) => { const meta = TYPE_META[type as keyof typeof TYPE_META]; const Icon = meta.icon; return <button className="metric" key={type} onClick={() => setView(type as ViewId)}><span className={`metric-icon ${meta.tone}`}><Icon size={20} /></span><span><label>{meta.label}</label><b>{count}<small> 项资源</small></b></span><ChevronRight size={16} /></button>; })}</div><section className="section-block"><div className="section-heading"><div><span className="section-kicker">UPSTREAM TO DOWNSTREAM</span><h2>四支柱业务地图</h2><p>按照海外渠道业务链路，从酒店资源方逐步走向渠道卖方。</p></div><button className="text-button" onClick={() => setView("map")}>查看完整地图<ArrowRight size={16} /></button></div><div className="direction-strip"><span className="endpoint">酒店资源方<br /><small>供应商</small></span>{BUSINESS_DIRECTIONS.map((direction, index) => { const items = resources.filter((r) => r.type === "SKILL" && r.businessDirection === direction.id && r.status === "PUBLISHED"); return <button className="direction-mini" key={direction.id} style={{ "--direction": DIRECTION_COLOR[direction.id] } as React.CSSProperties} onClick={() => setView("map")}><div className="direction-number">{direction.number}</div><div><b>{direction.label}</b><span>{items.length} 项 Skill</span></div>{index < 3 && <ChevronRight className="direction-chevron" size={18} />}</button>; })}<span className="endpoint right">渠道卖方<br /><small>下游</small></span></div></section><section className="home-grid"><div className="section-block"><div className="section-heading"><div><span className="section-kicker">RECOMMENDED FLOW</span><h2>推荐分析路径</h2></div><span className="muted-note">按实际先后关系连接</span></div><RelationFlow resources={resources} relations={relations} onSelect={onSelect} /></div><div className="section-block recent-block"><div className="section-heading"><div><span className="section-kicker">RECENTLY UPDATED</span><h2>最近更新</h2></div><button className="text-button" onClick={() => setView("updates")}>全部<ArrowRight size={15} /></button></div><div className="recent-list">{resources.slice(0, 4).map((resource) => { const Icon = TYPE_META[resource.type].icon; return <button key={resource.id} onClick={() => onSelect(resource)}><span className={`resource-icon ${TYPE_META[resource.type].tone}`}><Icon size={18} /></span><span><b>{resource.name}</b><small>{resource.ownerName} · {TYPE_META[resource.type].label}</small></span><ChevronRight size={15} /></button>; })}</div></div></section></>;
}

function CapabilityMap({ resources, onSelect, onBack }: { resources: ResourceView[]; onSelect: (r: ResourceView) => void; onBack: () => void }) {
  return <div className="capability-map-page">
    <button className="back-link map-back" onClick={onBack}>← 返回 Skills</button>
    <PageTitle eyebrow="UPSTREAM TO DOWNSTREAM" title="四支柱业务地图" subtitle="从酒店资源方到渠道卖方，按四个业务方向查找 Skill；分类表示业务归属，关联关系请在 Skill 详情中查看。" />
    <div className="map-flow-labels"><span>上游 · 酒店资源方 / 供应商</span><ArrowRight size={20} /><span>下游 · 渠道卖方</span></div>
    <div className="pillar-grid">{BUSINESS_DIRECTIONS.map((direction, index) => {
      const items = resources.filter((item) => item.type === "SKILL" && item.businessDirection === direction.id && item.status !== "ARCHIVED");
      return <div className="pillar-step" key={direction.id}><section className="pillar" style={{ "--direction": DIRECTION_COLOR[direction.id] } as React.CSSProperties}>
        <div className="pillar-head"><span>{direction.number}</span><div><h3>{direction.label}</h3><p>{direction.note}</p></div></div>
        <div className="pillar-items">{items.length ? items.map((item) => <button key={item.id} onClick={() => onSelect(item)}><div className="skill-dot" /><div><b>{item.name}</b><span>{item.summary}</span></div><ChevronRight size={18} /></button>) : <div className="empty-pillar"><Boxes size={28} /><span>暂无 Skill</span><small>这里将呈现未来沉淀的资源</small></div>}</div>
      </section>{index < BUSINESS_DIRECTIONS.length - 1 && <span className="pillar-connector" aria-hidden="true"><ArrowRight size={18} /></span>}</div>;
    })}</div>
  </div>;
}

function CatalogView({ view, scope, resources, relations, query, setQuery, setView, onSelect, onDirectory, canCreate, onCreate }: { view: ViewId; scope: string; resources: ResourceView[]; relations: SkillRelationView[]; query: string; setQuery: (value: string) => void; setView: (value: ViewId) => void; onSelect: (r: ResourceView) => void; onDirectory: (id:string,label:string)=>void; canCreate: boolean; onCreate: () => void }) {
  const isMine = view === "mine";
  const [directionFilter, setDirectionFilter] = useState("");
  const visibleResources = view === "SKILL" && directionFilter ? resources.filter((resource) => resource.businessDirection === directionFilter) : resources;
  const order: ResourceView["type"][] = ["SKILL", "MCP", "AGENT", "INTERNAL", "OTHER"];
  return <>
    {["dida", "overseas", "other"].includes(scope) && <div className="module-catalog-heading"><div><h1>{RESOURCE_MODULES[scope as ResourceModule]}</h1><p>本模块的全部资源，按类型汇总。</p></div>{canCreate && <button className="primary-button" onClick={onCreate}><Plus size={17} />创建资源</button>}</div>}
    {["SKILL", "MCP", "AGENT", "INTERNAL"].includes(view) && <div className="module-catalog-heading"><div><h1>{VIEW_LABELS[view]}</h1><p>此类型下你有权查看的全部资源。</p></div>{canCreate && view !== "INTERNAL" && <button className="primary-button" onClick={onCreate}><Plus size={17}/>创建资源</button>}</div>}
    {isMine && <div className="mine-heading compact-mine"><p>维护你创建的资源</p>{canCreate && <button className="primary-button" onClick={onCreate}><Plus size={17} />发布资源</button>}</div>}
    <div className="catalog-toolbar"><div className="searchbox"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索资源名称、标签、维护人或用途" /></div><span className="result-count">共 {visibleResources.length} 项资源</span></div>
    {!isMine && view === "SKILL" && <section className="business-filter"><div><span>Skill 业务地图</span><strong>按业务方向快速筛选</strong><button className="full-map-link" onClick={() => setView("map")}>查看完整地图 <ArrowRight size={14} /></button></div><div className="business-filter-items">{BUSINESS_DIRECTIONS.map((direction) => { const count = resources.filter((resource) => resource.businessDirection === direction.id).length; return <button className={directionFilter === direction.id ? "active" : ""} key={direction.id} style={{ "--direction": DIRECTION_COLOR[direction.id] } as React.CSSProperties} onClick={() => setDirectionFilter((current) => current === direction.id ? "" : direction.id)}><i>{direction.number}</i><span>{direction.label}<small>{count} 项 Skill</small></span><Check size={15} /></button>; })}</div></section>}
    {view === "INTERNAL" ? <div className="website-overview-groups">{[
      {id:"website-op",label:"海外OP常用网站",scenario:"overseas_op",description:"业务系统入口，按数据、静态、订单与配置分类。"},
      {id:"website-ai",label:"AI常用网站",scenario:"ai_tools",description:"AI 聊天、Agent 与资讯工具，按用途分类。"},
      {id:"website-other",label:"其他有用网站",scenario:"other_useful",description:"按团队整理的常用入口。"},
    ].map(group=>{const items=visibleResources.filter(resource=>resource.scenario===group.scenario).sort(compareWebsiteNames);return <section className={`website-overview-group${group.scenario==="ai_tools" ? " ai-site-directory" : ""}`} key={group.id}><header><div><h2>{group.label} <span>{items.length} 个网站</span></h2><p>{group.description}</p></div><button className="secondary-button" onClick={()=>onDirectory(group.id,group.label)}>{canCreate ? "查看与管理" : "查看目录"} <ArrowRight size={15}/></button></header>{items.length?(group.scenario==="other_useful"?<div className="website-shortcuts">{items.map(resource=><div className="website-shortcut" key={resource.id}><WebsiteShortcutLink name={resource.name} url={resource.sourceUrl??"#"} description={resource.summary}/></div>)}</div>:<div className="resource-grid large">{items.map(resource=><ResourceCard key={resource.id} resource={resource} relations={relations} onSelect={onSelect}/>)}</div>):<p className="shortcut-empty">暂无匹配网站，可进入目录添加。</p>}</section>;})}{visibleResources.some(resource=>!["overseas_op","ai_tools","other_useful"].includes(resource.scenario??""))&&<section className="website-overview-group"><h2>未分类网站</h2><div className="resource-grid large">{visibleResources.filter(resource=>!["overseas_op","ai_tools","other_useful"].includes(resource.scenario??"")).map(resource=><ResourceCard key={resource.id} resource={resource} relations={relations} onSelect={onSelect}/>)}</div></section>}</div> : view === "all" && !isMine ? <div className="resource-groups">{order.map((type) => { const group = visibleResources.filter((resource) => resource.type === type); if (!group.length) return null; const meta = TYPE_META[type]; const GroupIcon = meta.icon; return <section className="resource-group" key={type}><header className={`resource-group-heading ${meta.tone}`}><span><GroupIcon size={19} /></span><div><h2>{meta.label}</h2><p>{group.length} 项团队资源</p></div></header><div className="resource-grid large">{group.map((resource) => <ResourceCard key={resource.id} resource={resource} relations={relations} onSelect={onSelect} />)}</div></section>; })}{!visibleResources.length && <div className="empty-state"><Wrench size={30} /><h3>{scope === "other" ? "暂无其他资源" : "没有找到匹配的资源"}</h3><p>{scope === "other" ? canCreate ? "点击右上角创建资源，填写类别、名称、链接和使用说明。" : "团队发布到“其他”模块的资源会集中显示在这里。" : "尝试调整搜索词或切换资源分类。"}</p></div>}</div> : <div className="resource-grid large">{visibleResources.map((resource) => <ResourceCard key={resource.id} resource={resource} relations={relations} onSelect={onSelect} />)}{!visibleResources.length && <div className="empty-state"><Search size={30} /><h3>没有找到匹配的资源</h3><p>{isMine ? "还没有创建资源，可以从右上角发布第一项。" : "尝试调整搜索词或切换资源分类。"}</p></div>}</div>}
  </>;
}

function ResourceCard({ resource, relations, onSelect }: { resource: ResourceView; relations: SkillRelationView[]; onSelect: (r: ResourceView) => void }) {
  const meta = TYPE_META[resource.type]; const Icon = meta.icon;
  const relatedCount = relations.filter((relation) => relation.sourceSkillId === resource.id || relation.targetSkillId === resource.id).length;
  const updated = new Date(resource.updatedAt * 1000).toLocaleDateString("zh-CN");
  function openResource() {
    if (resource.type === "INTERNAL" && resource.sourceUrl) {
      window.open(resource.sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }
    onSelect(resource);
  }
  if (resource.type === "OTHER") return <button className="resource-card other-resource-card" onClick={openResource}><div className="resource-card-top"><span className="resource-icon blue"><Wrench size={20}/></span><span className="type-badge blue">{resource.scenario || "其他资源"}</span>{resource.status !== "PUBLISHED" && <span className="draft-badge">草稿</span>}</div><h3>{resource.name}</h3><p>{resource.summary}</p><div className="card-footer"><span className="owner-avatar">{resource.ownerName.slice(0,1)}</span><span>{resource.ownerName}</span><span className="version"><ExternalLink size={14}/></span></div><div className="card-stats"><span>{updated} 更新</span><span>查看使用说明</span></div></button>;
  if (resource.type === "INTERNAL") return <button className="website-resource-card" onClick={openResource}><div className="website-card-heading"><WebsiteIcon name={resource.name} scenario={resource.scenario} /><h3>{resource.name}</h3><ExternalLink size={16} /></div><p>{resource.summary}</p><footer><span>{resource.sourceUrl ? new URL(resource.sourceUrl).hostname : "链接待补充"}</span><b>打开网站 ↗</b></footer></button>;
return <button className="resource-card" onClick={openResource}><div className="resource-card-top"><span className={`resource-icon ${meta.tone}`}><Icon size={20} /></span><span className={`type-badge ${meta.tone}`}>{meta.label}</span>{resource.updateNotice && <span className="resource-update-badge" aria-label={resource.updateNotice.kind === "new" ? "未读新增资源" : "未读资源更新"}><i className="notice-dot" />{resource.updateNotice.kind === "new" ? "新增" : "更新"}</span>}{resource.status !== "PUBLISHED" && <span className="draft-badge">草稿</span>}</div><h3>{resource.name}</h3><p>{resource.summary}</p><div className="card-footer"><div className="owner-avatar">{resource.ownerName.slice(0, 1)}</div><span>{resource.ownerName}</span><span className="version">{resource.version ? `v${resource.version}` : ""}</span></div><div className="card-stats"><span><Clock size={13} />{updated} 更新</span><span><GitBranch size={13} />{relatedCount} 个关联资源</span></div></button>;
}

function RelationFlow({ resources, relations, onSelect }: { resources: ResourceView[]; relations: SkillRelationView[]; onSelect: (r: ResourceView) => void }) {
  const get = (id: string) => resources.find((resource) => resource.id === id);
  if (!relations.length) return <div className="empty-state"><GitBranch size={28} /><h3>暂无推荐路径</h3></div>;
  return <div className="relation-flow">{relations.map((relation, index) => { const source = get(relation.sourceSkillId); const target = get(relation.targetSkillId); if (!source || !target) return null; return <div className="relation-step" key={relation.id}>{index === 0 && <button onClick={() => onSelect(source)}><span>起点</span><b>{source.name}</b></button>}<div className="relation-arrow"><ArrowRight size={20} /><small>{relation.triggerCondition}</small></div><button onClick={() => onSelect(target)}><span>下一步</span><b>{target.name}</b></button></div>; })}</div>;
}



function UpdatesView({ resources, onSelect }: { resources: ResourceView[]; onSelect: (r: ResourceView) => void }) {
  return <><PageTitle eyebrow="CHANGELOG" title="更新动态" subtitle="追踪团队资源的新增、更新和版本变化。" /><div className="timeline">{resources.map((resource) => <button key={resource.id} onClick={() => onSelect(resource)}><span className={`timeline-icon ${TYPE_META[resource.type].tone}`}>{resource.version ? `v${resource.version}` : TYPE_META[resource.type].label}</span><div><b>{resource.name}</b><p>{resource.releaseNote || "资源信息已更新"}</p><small>{resource.ownerName} · {new Date(resource.updatedAt * 1000).toLocaleDateString("zh-CN")}</small></div><ChevronRight size={18} /></button>)}</div></>;
}

function GuideView({ user, setView }: { user: SafeUser; setView: (value: ViewId) => void }) {
  const canPublish = user.role === "ADMIN" || user.role === "CREATOR";
  return <><PageTitle eyebrow="GET STARTED" title="使用指南" subtitle="它不是一份静态说明书，而是帮助所有人更快找到、接入和正确使用团队资源的入口。" /><div className="guide-intro"><BookOpen size={22} /><div><h2>第一次使用，从这里开始</h2><p>Viewer 负责发现和使用资源；Creator 与 Admin 还可以发布、维护和连接团队经验。</p></div><span>{ROLE_LABELS[user.role]}</span></div><div className="guide-grid"><section><span>01 · FIND</span><Search size={24} /><h3>从问题找到资源</h3><p>按名称、用途、标签或维护人搜索，也可以直接进入 Skill、MCP、Agent 和内部网站分类。</p><button onClick={() => setView("all")}>浏览工作台总览<ArrowRight size={15} /></button></section><section><span>02 · START</span><Copy size={24} /><h3>复制指令，快速接入</h3><p>打开 Skill 或 MCP 详情，复制“给 AI 的安装指令”，再补充你的任务目标和必要输入。</p><button onClick={() => setView("SKILL")}>查看 Skill<ArrowRight size={15} /></button></section><section><span>03 · VERIFY</span><ShieldCheck size={24} /><h3>确认权限与结果边界</h3><p>安装密钥仅在本人客户端配置；在线初查凭据仅用于当次授权查询、不保存。先做只读验证，遇到问题联系维护人。</p><button onClick={() => setView("MCP")}>查看 MCP<ArrowRight size={15} /></button></section></div>{canPublish && <div className="creator-guide"><div><Sparkles size={20} /><span><b>创建者提示</b><small>发布时优先写清适用场景、必要输入、维护人和版本；只有存在明确先后关系时才添加 Skill 关联。</small></span></div><button onClick={() => setView("mine")}>管理我的资源<ArrowRight size={15} /></button></div>}</>;
}

function AdminView({ setNotice }: { setNotice: (value: string) => void }) {
  const [users, setUsers] = useState<UserWithKey[]>([]); const [credentials, setCredentials] = useState<Array<{ email: string; key: string }>>([]); const [busy, setBusy] = useState(false);
  const [error,setError]=useState("");
  const load = () => api<{ users: UserWithKey[] }>("/api/admin/users").then((data) => setUsers(data.users));
  useEffect(() => { load().catch(err=>setError(err.message)); }, []);
  async function reset(user:UserWithKey){
    if(busy||!confirm(`确定重置 ${user.displayName} 的 Access Key？该账号现有会话会立即失效。`))return;
    setBusy(true);setError("");try{const data=await api<{key:string}>(`/api/admin/users/${user.id}/reset-key`,{method:"POST"});setCredentials([{email:user.email,key:data.key}]);await load();}catch(err){setError(err instanceof Error?err.message:"重置失败");}finally{setBusy(false);}
  }
  async function generateAll(){
    setBusy(true);setError("");try{const data=await api<{credentials:Array<{email:string;key:string}>}>("/api/admin/users/bootstrap-keys",{method:"POST"});setCredentials(data.credentials);await load();setNotice(`已生成 ${data.credentials.length} 个初始 Key`);}catch(err){setError(err instanceof Error?err.message:"初始化失败");}finally{setBusy(false);}
  }
  return <><PageTitle eyebrow="ADMINISTRATION" title="账号与 Access Key" subtitle="账号清单以数据库为唯一事实来源；Key 仅在生成或重置时显示一次。" />{error&&<p className="form-error" role="alert">{error}</p>}<div className="admin-toolbar"><div><Users size={20} /><span>{users.length} 个授权账号</span></div><button className="primary-button" onClick={generateAll} disabled={busy || users.every((u) => u.hasKey)}><KeyRound size={17} />{busy ? "正在生成…" : "生成未初始化 Key"}</button></div>{credentials.length > 0 && <div className="credential-panel"><div><ShieldCheck size={20} /><div><b>请立即安全保存并分别发送</b><p>关闭或刷新后将无法再次查看这些 Key。</p></div></div><pre>{credentials.map((item) => `${formatLoginAccount(item.email)}\t${item.key}`).join("\n")}</pre><button onClick={() => navigator.clipboard.writeText(credentials.map((item) => `${formatLoginAccount(item.email)}\t${item.key}`).join("\n"))}>复制全部</button></div>}<div className="user-table"><div className="user-row header"><span>成员</span><span>角色</span><span>Access Key</span><span>操作</span></div>{users.map((item) => <div className="user-row" key={item.id}><span><b>{item.displayName}</b><small>{formatLoginAccount(item.email)}</small></span><span><i className={`role-pill ${item.role.toLowerCase()}`}>{item.role}</i></span><span><i className={item.hasKey ? "status-ready" : "status-missing"}>{item.hasKey ? "已配置" : "待初始化"}</i></span><span><button className="small-button" disabled={busy} onClick={() => reset(item)}>重置 Key</button></span></div>)}</div></>;
}

function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>;
}
