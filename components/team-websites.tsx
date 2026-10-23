"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpDown, ChevronRight, GripVertical, ExternalLink, Pencil, Plus, RotateCw, Search, Trash2, X } from "lucide-react";
import type { ResourceView, SafeUser } from "@/lib/resource-types";
import { canManageTeamWebsites, canEditTeamWebsites, WEBSITE_TEAMS, type TeamWebsite } from "@/lib/team-websites";
import { WebsiteIcon, WebsiteShortcutLink } from "@/components/website-mark";
import { WebsiteCategoryManager } from "@/components/website-category-manager";
import { useWebsiteArrangement, GroupOrderButtons } from "@/components/website-arrangement";
import { orderedWebsites } from "@/lib/website-layout";
import type { WebsiteCategory, WebsiteScenario } from "@/lib/website-categories";

import {api as request} from "@/lib/client-api";

export function TeamWebsites({ user, legacySites }: { user: SafeUser; legacySites: ResourceView[] }) {
  const arrange=useWebsiteArrangement(user.id,"teams");
  const websites=arrange.data?.websites??[];
  const loading=!arrange.data&&!arrange.error;
  const layout=arrange.data?.layouts.find(row=>row.scenario==="teams");
  const teams=orderedWebsites(WEBSITE_TEAMS,layout?.groupIds?.length?layout.groupIds:WEBSITE_TEAMS.map(team=>team.id));
  const canArrangeGroups=user.role==="CREATOR"||user.role==="ADMIN";
  const [groupOrderMode,setGroupOrderMode]=useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<{ teamId: string; website?: TeamWebsite } | null>(null);
  const [busyId, setBusyId] = useState("");
  async function load() {
    await arrange.reload();
  }

  async function remove(website: TeamWebsite) {
    if (!confirm(`删除“${website.name}”？这只会移除本组的网站入口。`)) return;
    setBusyId(website.id); setError("");
    try { await request(`/api/team-websites/${website.id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "删除失败"); }
    finally { setBusyId(""); }
  }
  const q = query.trim().toLowerCase();
  const matches = (name: string, url: string, description = "") => !q || `${name} ${url} ${description}`.toLowerCase().includes(q);
  return <div className="team-websites-page shortcut-directory">
    <div className="catalog-toolbar"><div className="searchbox"><Search size={17} /><input aria-label="搜索小组网站" placeholder="搜索网站名称或网址" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="result-count">{WEBSITE_TEAMS.length} 个组 · {websites.length} 个网站</span><button className="secondary-button" aria-label="刷新网站目录" title="获取最新目录，不刷新整页" disabled={arrange.busy} onClick={()=>void arrange.refresh()}><RotateCw size={15}/></button>{canArrangeGroups&&<button className="secondary-button group-sort-toggle" aria-pressed={groupOrderMode} onClick={()=>setGroupOrderMode(value=>!value)}><ArrowUpDown size={15}/>{groupOrderMode?"完成排序":"分组排序"}</button>}</div>
    {canArrangeGroups&&<ArrangementHint groupOrderMode={groupOrderMode}/>}
    {(error||arrange.error) && <div className="form-error" role="alert">{error||arrange.error}<button className="text-button" onClick={() => { setError(""); arrange.setError(""); load().catch((err) => setError(err.message)); }}>重试</button></div>}
    {loading ? <div className="team-loading">正在加载小组网站…</div> : <div className="shortcut-groups">{teams.map((team) => {
      const sites = orderedWebsites(websites.filter((website) => website.teamId === team.id && matches(website.name, website.url, website.description)),layout?.siteIds??[]);
      const editable = canEditTeamWebsites(user, team.id);
      const canAdd = canEditTeamWebsites(user, team.id);
      const expanded = !groupOrderMode && (Boolean(q) || !collapsed[team.id]);
      return <section className={`shortcut-group${arrange.dropClass("group:"+team.id)}${groupOrderMode?" group-order-mode":""}`} key={team.id} onDragOver={event=>arrange.over(event,"group:"+team.id)} onDrop={event=>{if(!arrange.drag)return;event.preventDefault();event.stopPropagation();if(arrange.drag.kind==="group"&&canArrangeGroups)void arrange.reorderGroup(arrange.drag.id,team.id,teams.map(item=>item.id),arrange.dropAfter());else if(arrange.drag.kind==="site"&&editable)void arrange.move(arrange.drag.id,team.id);}}>
        <header {...arrange.dragProps("group",team.id,canArrangeGroups)} className={canArrangeGroups?"draggable-group-heading":""} aria-label={`拖动分组 ${team.name}`}>{canArrangeGroups&&groupOrderMode&&<GripVertical size={17} aria-hidden="true"/>}<button className="shortcut-group-toggle" aria-expanded={expanded} onClick={() => {if(!groupOrderMode)setCollapsed((current) => ({ ...current, [team.id]: !current[team.id] }));}}><ChevronRight size={16} className={expanded ? "expanded" : ""} /><h2>{team.name}</h2><span>{sites.length}</span></button>{canArrangeGroups&&groupOrderMode&&<GroupOrderButtons id={team.id} name={team.name} groupIds={teams.map(item=>item.id)} arrange={arrange}/>}{canAdd && !groupOrderMode && <button className="team-add" onClick={() => { setCollapsed((current) => ({ ...current, [team.id]: false })); setEditor({ teamId: team.id }); }}><Plus size={15} />添加网站</button>}</header>
        {expanded && <div className="website-shortcuts">{sites.map((website) => <div className={`website-shortcut${editable?" draggable-website":""}${arrange.drag?.id===website.id?" dragging":""}${arrange.dropClass("site:"+website.id)}`} key={website.id} {...arrange.dragProps("site",website.id,editable)} tabIndex={editable?0:undefined} aria-label={editable?`拖动网站 ${website.name}`:undefined} aria-describedby={editable?"website-arrangement-hint":undefined} onKeyDown={event=>{if(editable)arrange.keyboardMove(event,website.id,team.id,orderedWebsites(websites,layout?.siteIds??[]).map(site=>({id:site.id,groupId:site.teamId})),teams.filter(group=>canEditTeamWebsites(user,group.id)));}} data-website-id={website.id} onDragOver={event=>{if(arrange.drag?.kind==="site")arrange.over(event,"site:"+website.id);}} onDrop={event=>{if(arrange.drag?.kind!=="site"||!editable)return;event.preventDefault();event.stopPropagation();void arrange.move(arrange.drag.id,team.id,arrange.beforeCard(arrange.drag.id,website.id,team.id,orderedWebsites(websites,layout?.siteIds??[]).map(site=>({id:site.id,groupId:site.teamId}))));}}>
<WebsiteShortcutLink name={website.name} url={website.url} description={website.description}/>
          {editable && <div className="shortcut-edit-actions"><button aria-label={`编辑 ${website.name}`} disabled={busyId === website.id} onClick={() => setEditor({ teamId: team.id, website })}><Pencil size={13} /></button>{canManageTeamWebsites(user, team.id) && <button aria-label={`删除 ${website.name}`} disabled={busyId === website.id} onClick={() => remove(website)}><Trash2 size={13} /></button>}</div>}
        </div>)}{!sites.length && <div className="shortcut-empty">{q ? "没有匹配的网站" : canAdd ? "点击“添加网站”，收录本组常用入口。" : "暂未添加网站"}</div>}</div>}
      </section>;
    })}</div>}
    <p className="website-arrange-status" role="status">{arrange.busy?"正在保存移动…":arrange.status}</p>
    {!!legacySites.length && <section className="legacy-websites"><h2>已有网站</h2>{legacySites.filter((site) => matches(site.name, site.sourceUrl ?? "")).map((site) => <a key={site.id} href={site.sourceUrl ?? "#"} target="_blank" rel="noopener noreferrer">{site.name}<ExternalLink size={14} /></a>)}</section>}
    {editor && <WebsiteEditor key={editor.website?.id ?? editor.teamId} teamId={editor.teamId} website={editor.website} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); try { await load(); } catch { setError("已保存网站，列表刷新失败，请点击重试。"); } }} />}
  </div>;
}

type WebsiteEntry = { id: string; name: string; description: string; url: string; websiteCategoryId?: string | null };

export function CommonWebsites({ user, resources, scenario, onChanged }: { user: SafeUser; resources: ResourceView[]; scenario: WebsiteScenario; onChanged: () => Promise<void> }) {
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("");
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const arrange=useWebsiteArrangement(user.id,scenario,onChanged,resources.map(site=>({id:site.id,name:site.name,groupId:site.websiteCategoryId??"unclassified"})));
  const categories=arrange.data?.categories.filter(item=>item.scenario===scenario)??[];
  const categoriesLoading=!arrange.data&&!arrange.error;
  const layout=arrange.data?.layouts.find(row=>row.scenario===scenario);
  const [groupOrderMode,setGroupOrderMode]=useState(false);
  const [manage,setManage]=useState(false);
  const [editor,setEditor]=useState<{website?:WebsiteEntry}|null>(null);
  const [error,setError]=useState(""),[busyId,setBusyId]=useState("");
  const canAdd=user.role==="ADMIN"||user.role==="CREATOR";
  async function loadCategories() {
    const result=await arrange.reload();
    return result.categories.filter(item=>item.scenario===scenario);
  }

  const q=query.trim().toLowerCase();
  const sites=orderedWebsites(resources.filter(site=>!q||`${site.name} ${site.summary} ${site.sourceUrl??""}`.toLowerCase().includes(q)),layout?.siteIds??[]);
  const categoryFor=(site:ResourceView)=>categories.some(category=>category.id===(arrange.memberships[site.id]??site.websiteCategoryId))?(arrange.memberships[site.id]??site.websiteCategoryId)!:"unclassified";
  const groups=[...categories,{id:"unclassified",scenario,name:"未分类",sortOrder:999}];
  async function remove(site:ResourceView) {
    if(!confirm(`删除“${site.name}”的网站入口？`))return;
    setBusyId(site.id);setError("");
    try{await request(`/api/resources/${site.id}`,{method:"DELETE"});await onChanged();}catch(err){setError(err instanceof Error?err.message:"删除失败");}finally{setBusyId("");}
  }
  const card=(site:ResourceView)=><div className={`website-directory-item${canAdd?" with-edit-actions draggable-website":""}${arrange.drag?.id===site.id?" dragging":""}${arrange.dropClass("site:"+site.id)}`} key={site.id} {...arrange.dragProps("site",site.id,canAdd)} tabIndex={canAdd?0:undefined} aria-label={canAdd?`拖动网站 ${site.name}`:undefined} aria-describedby={canAdd?"website-arrangement-hint":undefined} onKeyDown={event=>{if(canAdd)arrange.keyboardMove(event,site.id,categoryFor(site),orderedWebsites(resources,layout?.siteIds??[]).map(item=>({id:item.id,groupId:categoryFor(item)})),groups);}} data-website-id={site.id} onDragOver={event=>{if(arrange.drag?.kind==="site")arrange.over(event,"site:"+site.id);}} onDrop={event=>{if(!canAdd||arrange.drag?.kind!=="site")return;event.preventDefault();event.stopPropagation();void arrange.move(arrange.drag.id,categoryFor(site),arrange.beforeCard(arrange.drag.id,site.id,categoryFor(site),orderedWebsites(resources,layout?.siteIds??[]).map(item=>({id:item.id,groupId:categoryFor(item)}))));}}>
    <a draggable={false} className="website-resource-card" href={site.sourceUrl||undefined} target="_blank" rel="noopener noreferrer" title={site.summary}><div className="website-card-heading"><WebsiteIcon name={site.name} scenario={scenario}/><h3>{site.name}</h3><ExternalLink size={16}/></div><p>{site.summary}</p><footer><span>{site.sourceUrl?new URL(site.sourceUrl).hostname:"链接待补充"}</span><b>打开网站 ↗</b></footer></a>
    {canAdd&&<div className="website-directory-actions"><button className="text-button" disabled={busyId===site.id} onClick={()=>setEditor({website:{id:site.id,name:site.name,description:site.summary,url:site.sourceUrl??"",websiteCategoryId:site.websiteCategoryId}})}><Pencil size={13}/>编辑</button>{(user.role==="ADMIN"||site.ownerId===user.id)&&<button className="text-button" disabled={busyId===site.id} onClick={()=>remove(site)}><Trash2 size={13}/>删除</button>}</div>}
  </div>;
  return <div className={`common-websites-page${scenario==="ai_tools"?" ai-site-directory":""}`}>
    <div className="catalog-toolbar website-catalog-toolbar"><div className="searchbox"><Search size={17}/><input aria-label="搜索常用网站" placeholder="搜索名称、功能说明或网址" value={query} onChange={event=>setQuery(event.target.value)}/></div><span className="result-count">共 {sites.length} 个网站</span><button className="secondary-button" aria-label="刷新网站目录" title="获取最新目录，不刷新整页" disabled={arrange.busy} onClick={()=>void arrange.refresh()}><RotateCw size={15}/></button>{canAdd&&<><button className="secondary-button group-sort-toggle" aria-pressed={groupOrderMode} onClick={()=>{setFilter("");setGroupOrderMode(value=>!value);}}><ArrowUpDown size={15}/>{groupOrderMode?"完成排序":"分组排序"}</button><button className="secondary-button" onClick={()=>setManage(true)} disabled={categoriesLoading}>管理分类</button><button className="primary-button" onClick={()=>setEditor({})} disabled={categoriesLoading}><Plus size={16}/>添加网站</button></>}</div>
    {canAdd&&<ArrangementHint groupOrderMode={groupOrderMode}/>}
    <div className="website-category-filters" aria-label="网站分类"><button className={!filter?"active":""} onClick={()=>setFilter("")}>全部</button>{groups.filter(group=>group.id!=="unclassified"||sites.some(site=>categoryFor(site)===group.id)).map(group=><button className={filter===group.id?"active":""} key={group.id} onClick={()=>setFilter(group.id)}>{group.name}<span>{sites.filter(site=>categoryFor(site)===group.id).length}</span></button>)}</div>
    {(error||arrange.error)&&<div className="form-error" role="alert">{error||arrange.error}<button className="text-button" onClick={()=>{setError("");void loadCategories().catch(err=>setError(err.message));}}>重试</button></div>}
    {categoriesLoading?<div className="team-loading">正在加载网站分类…</div>:groups.filter(group=>!filter||group.id===filter).map(group=>{const items=sites.filter(site=>categoryFor(site)===group.id);if(!items.length&&!filter&&group.id==="unclassified"&&!arrange.drag)return null;const expanded=!groupOrderMode&&(Boolean(q)||!collapsed[group.id]);return <section className={`website-category-group${arrange.dropClass("group:"+group.id)}${groupOrderMode?" group-order-mode":""}`} key={group.id} onDragOver={event=>{if(arrange.drag?.kind!=="group"||group.id!=="unclassified")arrange.over(event,"group:"+group.id);}} onDrop={event=>{if(!canAdd||!arrange.drag)return;event.preventDefault();event.stopPropagation();if(arrange.drag.kind==="group")void arrange.reorderGroup(arrange.drag.id,group.id,categories.map(item=>item.id),arrange.dropAfter());else void arrange.move(arrange.drag.id,group.id);}}><header {...arrange.dragProps("group",group.id,canAdd&&group.id!=="unclassified")} className={canAdd&&group.id!=="unclassified"?"draggable-group-heading":""} aria-label={`拖动分组 ${group.name}`}>{canAdd&&groupOrderMode&&<GripVertical size={17} aria-hidden="true"/>}<button className="website-category-toggle" aria-expanded={expanded} aria-controls={`category-items-${group.id}`} onClick={()=>{if(!groupOrderMode)setCollapsed(current=>({...current,[group.id]:!current[group.id]}));}}><ChevronRight size={17} className={expanded?"expanded":""}/><h2>{group.name}</h2><span>{items.length} 个网站</span></button>{canAdd&&groupOrderMode&&group.id!=="unclassified"&&<GroupOrderButtons id={group.id} name={group.name} groupIds={categories.map(item=>item.id)} arrange={arrange}/>}</header>{expanded&&<div id={`category-items-${group.id}`}><div className="resource-grid large">{items.map(card)}</div>{!items.length&&<p className="shortcut-empty">这个分类暂未添加网站。</p>}</div>}</section>;})}
    <p className="website-arrange-status" role="status">{arrange.busy?"正在保存移动…":arrange.status}</p>
    {!categoriesLoading&&!sites.length&&!filter&&<div className="empty-state"><Search size={28}/><h3>{q?"没有匹配的网站":"暂未添加网站"}</h3><p>{canAdd?"点击右上角“添加网站”，填写功能说明并选择分类。":"团队收录的网站会显示在这里。"}</p></div>}
    {editor&&<WebsiteEditor key={editor.website?.id??scenario} scenario={scenario} website={editor.website} categories={categories} onCategoriesChanged={loadCategories} onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);try{await Promise.all([onChanged(),arrange.reload()]);}catch{setError("网站已保存，列表刷新失败，请刷新页面查看。");}}}/>}
    {manage&&<WebsiteCategoryManager scenario={scenario} categories={categories} onClose={()=>setManage(false)} onChanged={async()=>{await Promise.all([loadCategories(),onChanged()]);setFilter("");}}/>}
  </div>;
}

function ArrangementHint({groupOrderMode}:{groupOrderMode:boolean}) {
  return <p id="website-arrangement-hint" className="website-arrangement-hint">{groupOrderMode?"拖动整行分组标题，蓝色横线表示松手后的放置位置；也可点击上下箭头，顺序自动保存。":"按住卡片拖动，蓝色线条表示插入位置；拖到分组标题可更换分组，单击卡片仍打开网站。"}<span className="sr-only">聚焦卡片后，Alt 加方向键排序；Alt 加 Shift 加上下方向键更换有权限的分组。</span></p>;
}

function WebsiteEditor({ teamId, scenario, website, categories = [], onCategoriesChanged, onClose, onSaved }: { teamId?: string; scenario?: WebsiteScenario; website?: WebsiteEntry; categories?: WebsiteCategory[]; onCategoriesChanged?: () => Promise<WebsiteCategory[]>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryId,setCategoryId]=useState(website?.websiteCategoryId??"");
  const [newCategory,setNewCategory]=useState<string|null>(null);
  async function addCategory(){setBusy(true);setError("");try{const result=await request<{id:string}>("/api/website-categories",{method:"POST",body:JSON.stringify({name:newCategory,scenario})});await onCategoriesChanged?.();setCategoryId(result.id);setNewCategory(null);}catch(err){setError(err instanceof Error?err.message:"新建分类失败");}finally{setBusy(false);}}
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const payload = teamId ? { teamId, name: form.get("name"), description: form.get("description"), url: form.get("url") } : { type: "INTERNAL", scenario, websiteCategoryId:categoryId, name: form.get("name"), summary: form.get("description"), sourceUrl: form.get("url"), installationMode: "none", ...(!website ? { slug: `website-${crypto.randomUUID()}` } : {}) };
      const endpoint = teamId ? "/api/team-websites" : "/api/resources";
      await request(website ? `${endpoint}/${website.id}` : endpoint, { method: website ? "PUT" : "POST", body: JSON.stringify(payload) });
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); setBusy(false); }
  }
  return <dialog className="website-dialog" ref={dialogRef} aria-labelledby="website-editor-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><form className="website-editor" onSubmit={submit}>
    <header><div><h2 id="website-editor-title">{website ? "编辑网站" : "添加网站"}</h2><p>{teamId ? WEBSITE_TEAMS.find((team) => team.id === teamId)?.name : scenario === "overseas_op" ? "海外 OP 常用网站" : "AI 常用网站"}</p></div><button type="button" className="editor-close" aria-label="关闭" onClick={onClose} disabled={busy}><X size={18} /></button></header>
    <label>网站名称<input name="name" defaultValue={website?.name} maxLength={100} required autoFocus placeholder="例如：团队排班表" /></label>
    <label>网站功能说明<textarea name="description" defaultValue={website?.description} maxLength={500} rows={3} required placeholder="说明这个网站能做什么，例如：查询订单详情、操作日志和处理状态。" /></label>
    {!teamId&&<div className="website-category-field"><label>分类<select name="websiteCategoryId" required value={categoryId} onChange={event=>setCategoryId(event.target.value)}><option value="">请选择分类</option>{categories.map(category=><option value={category.id} key={category.id}>{category.name}</option>)}</select></label><button type="button" className="text-button" disabled={busy} onClick={()=>setNewCategory(value=>value===null?"":null)}><Plus size={13}/>新建分类</button>{newCategory!==null&&<div className="inline-category-create"><input aria-label="新分类名称" maxLength={40} value={newCategory} onChange={event=>setNewCategory(event.target.value)} placeholder="输入分类名称"/><button type="button" className="small-button" disabled={busy||!newCategory.trim()} onClick={addCategory}>创建并选用</button></div>}</div>}
    <label>网址<input name="url" type="url" maxLength={2048} defaultValue={website?.url} required placeholder="https://..." /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <footer><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>取消</button><button className="primary-button" disabled={busy}>{busy ? "保存中…" : "保存网站"}</button></footer>
  </form></dialog>;
}
