"use client";
import {api} from "@/lib/client-api";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import type { WebsiteCategory, WebsiteScenario } from "@/lib/website-categories";

export function WebsiteCategoryManager({ scenario, categories, onClose, onChanged }: { scenario: WebsiteScenario; categories: WebsiteCategory[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ordered,setOrdered] = useState(categories);
  const [dragged,setDragged] = useState<string | null>(null);
  const [drop,setDrop]=useState<{id:string;after:boolean}|null>(null);
  const [status,setStatus] = useState("");
  useEffect(() => setOrdered(categories), [categories]);
  const [names,setNames] = useState<Record<string,string>>({});
  const [name,setName] = useState("");
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  useEffect(() => { const el=dialog.current;el?.showModal();return () => el?.close(); },[]);
  async function reorder(id: string, targetId: string, after?:boolean) {
    if (busy || id === targetId) return;
    const before = ordered;
    const next = [...ordered], from = next.findIndex(item => item.id === id), to = next.findIndex(item => item.id === targetId);
    if (from < 0 || to < 0) return;
    const moving=next.splice(from,1)[0];next.splice(after===undefined?to:next.findIndex(item=>item.id===targetId)+(after?1:0),0,moving);
    setDrop(null);
    setOrdered(next); setDragged(null); setBusy(true); setError(""); setStatus("");
    try {
      await api("/api/website-categories/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario, ids: next.map(item => item.id) }) });
      await onChanged(); setStatus("分类顺序已保存");
    } catch (err) { setOrdered(before); setError(err instanceof Error ? err.message : "排序保存失败"); }
    finally { setBusy(false); }
  }
  async function mutate(method: string, id?: string, value?: string) {
    if (method === "DELETE" && !confirm("删除这个分类？分类下的网站会保留，并移至“未分类”。")) return;
    setBusy(true);setError("");
    try {
      await api("/api/website-categories"+(id?`/${id}`:""),{method,headers:{"Content-Type":"application/json"},...(method!=="DELETE"?{body:JSON.stringify({name:value,scenario})}:{})});
      await onChanged();setName("");if(id)setNames(current=>{const next={...current};delete next[id];return next;});
    }catch(err){setError(err instanceof Error?err.message:"保存失败");}finally{setBusy(false);}
  }
  return <dialog className="website-dialog" ref={dialog} aria-labelledby="category-manager-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}><div className="website-editor category-manager">
    <header><div><h2 id="category-manager-title">管理分类</h2><p>{scenario==="overseas_op"?"海外 OP 常用网站":"AI 常用网站"} · 拖动手柄，或直接选择目标序号，一步调整优先级；顺序自动保存；删除分类不会删除网站</p></div><button type="button" className="editor-close" aria-label="关闭分类管理" disabled={busy} onClick={onClose}><X size={18}/></button></header>
    <div className="category-manager-list">{ordered.map((category,index)=><div className={`category-manager-row${dragged===category.id?" dragging":""}${drop?.id===category.id?(drop.after?" drop-after":" drop-before"):""}`} key={category.id} data-category-id={category.id} onDragOver={event=>{if(!busy&&dragged){event.preventDefault();event.dataTransfer.dropEffect="move";const rect=event.currentTarget.getBoundingClientRect();setDrop({id:category.id,after:event.clientY>rect.top+rect.height/2});}}} onDrop={event=>{event.preventDefault();const id=event.dataTransfer.getData("text/plain");if(dragged===id)void reorder(id,category.id,drop?.after??false);}}><button type="button" className="category-drag-handle" aria-label={`拖动排序 ${category.name}`} title="拖动调整优先级" draggable={!busy} disabled={busy} onDragStart={event=>{setDragged(category.id);event.dataTransfer.setData("text/plain",category.id);event.dataTransfer.effectAllowed="move";}} onDragEnd={()=>{setDragged(null);setDrop(null);}}><GripVertical size={17}/></button><select className="category-position-select" aria-label={`分类顺序 ${category.name}`} value={index} disabled={busy} onChange={event=>void reorder(category.id,ordered[Number(event.target.value)].id)}>{ordered.map((_,position)=><option value={position} key={position}>第 {position+1} 位</option>)}</select><input aria-label={`分类名称 ${category.name}`} value={names[category.id]??category.name} maxLength={40} disabled={busy} onChange={event=>setNames(current=>({...current,[category.id]:event.target.value}))}/><div className="category-order-buttons"><button type="button" className="icon-button" aria-label={`上移分类 ${category.name}`} disabled={busy||index===0} onClick={()=>void reorder(category.id,ordered[index-1].id)}><ArrowUp size={13}/></button><button type="button" className="icon-button" aria-label={`下移分类 ${category.name}`} disabled={busy||index===ordered.length-1} onClick={()=>void reorder(category.id,ordered[index+1].id)}><ArrowDown size={13}/></button></div><button type="button" className="small-button" disabled={busy||!(names[category.id]?.trim())||names[category.id]===category.name} onClick={()=>mutate("PUT",category.id,names[category.id])}>保存</button><button type="button" className="icon-button" aria-label={`删除分类 ${category.name}`} disabled={busy} onClick={()=>mutate("DELETE",category.id)}><Trash2 size={15}/></button></div>)}</div>
    <label>新分类名称<input value={name} maxLength={40} placeholder="例如：团队协作" disabled={busy} onChange={event=>setName(event.target.value)}/></label><button type="button" className="small-button category-add" disabled={busy||!name.trim()} onClick={()=>mutate("POST",undefined,name)}><Plus size={14}/>新增分类</button>
    <p className="category-sort-status" role="status">{busy ? "正在保存…" : status}</p>
    {error&&<div className="form-error" role="alert">{error}</div>}<footer><button className="primary-button" disabled={busy} onClick={onClose}>完成</button></footer>
  </div></dialog>;
}
