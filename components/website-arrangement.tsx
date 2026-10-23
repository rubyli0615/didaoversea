"use client";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { clearWebsiteDirectories, loadWebsiteDirectories } from "@/lib/website-directory-client";
import { orderedWebsites } from "@/lib/website-layout";
import type { DirectoryData } from "@/lib/website-layout";
export function useWebsiteArrangement(userId:string, scenario:string, onChanged?:()=>Promise<void>, sites: {id:string;name:string;groupId:string}[] = []) {
  const [data,setData]=useState<DirectoryData|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [drag,setDrag]=useState<{kind:"site"|"group";id:string}|null>(null);
  const [dropTarget,setDropTarget]=useState("");
  const blocked=useRef(false),saving=useRef(false),dropAfter=useRef(false);
  const [memberships,setMemberships]=useState<Record<string,string>>({});
  async function reload(){const next=await loadWebsiteDirectories(userId,true);setData(next);setMemberships({});return next;}
  useEffect(()=>{let active=true;setData(null);loadWebsiteDirectories(userId).then(next=>{if(active)setData(next);}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[userId]);
  async function mutate(body:{siteId?:string;groupId?:string;beforeId?:string|null;groupIds?:string[];ids?:string[]},url="/api/website-layout") {
    if(saving.current||!data)return;
    saving.current=true;
    const previous=data,previousMemberships=memberships;
    const layout=data.layouts.find(row=>row.scenario===scenario)??{scenario,siteIds:[],groupIds:[],revision:0};
    let siteIds=layout.siteIds;
    if(body.siteId) {
      const all:{id:string;name:string}[]=scenario==="teams"?data.websites:sites;
      siteIds=orderedWebsites(all,siteIds).map(site=>site.id).filter(id=>id!==body.siteId);
      const position=body.beforeId?siteIds.indexOf(body.beforeId):siteIds.length;
      siteIds.splice(position<0?siteIds.length:position,0,body.siteId);
      setMemberships(current=>({...current,[body.siteId!]:body.groupId!}));
    }
    const optimistic={...data,
      categories:body.ids?data.categories.map(row=>row.scenario===scenario?{...row,sortOrder:body.ids!.indexOf(row.id)}:row).sort((a,b)=>a.sortOrder-b.sortOrder):data.categories,
      websites:body.siteId&&scenario==="teams"?data.websites.map(row=>row.id===body.siteId?{...row,teamId:body.groupId!}:row):data.websites,
      layouts:[...data.layouts.filter(row=>row.scenario!==scenario),{...layout,siteIds,groupIds:body.groupIds??layout.groupIds}]
    };
    setData(optimistic);setBusy(true);setError("");setStatus("");setDrag(null);setDropTarget("");
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(url,{method:"PUT",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({scenario,revision:layout.revision,...body})});
      const result=await response.json() as {error?:string;layout?:typeof layout};
      if(!response.ok)throw Error(result.error||"移动失败");
      if(result.layout)setData(current=>current?{...current,layouts:[...current.layouts.filter(row=>row.scenario!==scenario),result.layout!]}:current);
      clearWebsiteDirectories(userId);
      setStatus("移动已保存");
      // The saved response is authoritative; do not block the visible move on two full list reloads.
      if(body.siteId&&body.groupId&&sites.find(site=>site.id===body.siteId)?.groupId!==body.groupId)void onChanged?.().catch(()=>setStatus("移动已保存；其他列表稍后刷新"));
    }catch(err){
      setData(previous);setMemberships(previousMemberships);
      setError(err instanceof Error?err.message:"移动失败，已恢复原位置");
      clearWebsiteDirectories(userId);
      await reload().catch(()=>null);
    }finally{clearTimeout(timeout);saving.current=false;setBusy(false);}
  }
  async function refresh(){if(busy)return;setBusy(true);setError("");try{await Promise.all([reload(),onChanged?.()]);}catch(err){setError(err instanceof Error?err.message:"目录刷新失败");}finally{setBusy(false);}}
  function move(siteId:string,groupId:string,beforeId:string|null=null){if(siteId===beforeId)return;return mutate({siteId,groupId,beforeId});}
  function beforeCard(sourceId:string,targetId:string,groupId:string,sites:{id:string;groupId:string}[]) {
    const peers=sites.filter(site=>site.groupId===groupId&&site.id!==sourceId),to=peers.findIndex(site=>site.id===targetId);
    return dropAfter.current?peers[to+1]?.id??null:targetId;
  }
  function reorderGroup(id:string,targetId:string,groupIds:string[],after?:boolean) {
    const from=groupIds.indexOf(id),to=groupIds.indexOf(targetId);
    if(from<0||to<0||from===to)return;
    const next=groupIds.filter(item=>item!==id),target=next.indexOf(targetId);
    next.splice(after===undefined?to:target+(after?1:0),0,id);
    return scenario==="teams"?mutate({groupIds:next}):mutate({ids:next},"/api/website-categories/reorder");
  }
  const over=(event:DragEvent,target="")=>{if(drag&&!busy){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";const rect=event.currentTarget.getBoundingClientRect();
    dropAfter.current=target.startsWith("site:")?event.clientX>rect.left+rect.width/2:event.clientY>rect.top+Math.min(rect.height,64)/2;
    setDropTarget(target+(dropAfter.current?":after":":before"));}};
  function dropClass(target:string){return dropTarget===target+":before"?" drop-before":dropTarget===target+":after"?" drop-after":"";}
  function dragProps(kind:"site"|"group",id:string,enabled:boolean) {
    return {
      draggable:enabled&&!busy,
      onPointerDownCapture:(event:PointerEvent<HTMLElement>)=>{
        const control=(event.target as HTMLElement).closest("input,select,textarea,button,summary,details");
        blocked.current=Boolean(control && !(kind==="group" && control.matches(".website-category-toggle,.shortcut-group-toggle")));
      },
      onDragStart:(event:DragEvent<HTMLElement>)=>{
        if(!enabled||busy||blocked.current){event.preventDefault();return;}
        event.stopPropagation();event.dataTransfer.setData("application/x-dida-website",id);event.dataTransfer.effectAllowed="move";setDrag({kind,id});
      },
      onDragEnd:()=>{setDrag(null);setDropTarget("");},
    };
  }
  function keyboardMove(event:KeyboardEvent<HTMLElement>,id:string,groupId:string,sites:{id:string;groupId:string}[],groups:{id:string}[]) {
    if(!event.altKey||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key))return;
    if((event.target as HTMLElement).closest("button,input,select,textarea,summary"))return;
    event.preventDefault();event.stopPropagation();
    const backwards=event.key==="ArrowUp"||event.key==="ArrowLeft";
    if(event.shiftKey){const index=groups.findIndex(group=>group.id===groupId),target=groups[index+(backwards?-1:1)];if(target)void move(id,target.id);return;}
    const peers=sites.filter(site=>site.groupId===groupId),index=peers.findIndex(site=>site.id===id);
    if(backwards&&index>0)void move(id,groupId,peers[index-1].id);
    if(!backwards&&index>=0&&index<peers.length-1)void move(id,groupId,peers[index+2]?.id??null);
  }
  return {memberships,dropClass,dropAfter:()=>dropAfter.current,data,error,setError,busy,status,drag,dropTarget,setDrag,reload,refresh,move,beforeCard,reorderGroup,over,dragProps,keyboardMove};
}
export function GroupOrderButtons({id,name,groupIds,arrange}:{id:string;name:string;groupIds:string[];arrange:ReturnType<typeof useWebsiteArrangement>}) {
  const index=groupIds.indexOf(id);
  return <div className="group-sort-actions"><button type="button" className="secondary-button" aria-label={`上移分组 ${name}`} disabled={arrange.busy||index<=0} onClick={()=>void arrange.reorderGroup(id,groupIds[index-1],groupIds)}><ArrowUp size={16}/></button><button type="button" className="secondary-button" aria-label={`下移分组 ${name}`} disabled={arrange.busy||index<0||index===groupIds.length-1} onClick={()=>void arrange.reorderGroup(id,groupIds[index+1],groupIds)}><ArrowDown size={16}/></button></div>;
}
