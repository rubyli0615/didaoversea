"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { MAX_OPEN_TABS, tabIdsToClose, type TabCloseMode, type WorkspaceTab } from "@/lib/workspace-tabs";

export function WorkspaceTabs({tabs,activeId,onActivate,onCloseMany}:{tabs:WorkspaceTab[];activeId:string;onActivate:(tab:WorkspaceTab)=>void;onCloseMany:(ids:string[])=>void}){
  const strip=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null);
  const [menu,setMenu]=useState<{id:string;x:number}|null>(null);
  useEffect(()=>{const container=strip.current,item=container?.querySelector<HTMLElement>(".workspace-tab.active");if(!container||!item)return;const bounds=container.getBoundingClientRect(),active=item.getBoundingClientRect();if(active.left<bounds.left)container.scrollLeft-=bounds.left-active.left;else if(active.right>bounds.right)container.scrollLeft+=active.right-bounds.right;},[activeId]);
  useEffect(()=>{if(!menu)return;const dismiss=(event:PointerEvent)=>{if(!(event.target instanceof Element)||!event.target.closest(".workspace-tab-dropdown,.workspace-tab-menu-toggle"))setMenu(null);};const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setMenu(null);};document.addEventListener("pointerdown",dismiss);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",key);};},[menu]);
  function showMenu(id:string,target:HTMLElement){const r=target.getBoundingClientRect(),s=shell.current!.getBoundingClientRect();setMenu({id,x:Math.max(0,Math.min(r.left-s.left,s.width-190))});}
  function close(mode:TabCloseMode){if(menu)onCloseMany(tabIdsToClose(tabs,menu.id,mode));setMenu(null);}
  return <div className="workspace-tabs-shell" ref={shell}>
    <div className="workspace-tabs" ref={strip} aria-label="已打开页面">{tabs.map(tab=><div className={`workspace-tab${activeId===tab.id?" active":""}`} key={tab.id} onContextMenu={event=>{event.preventDefault();showMenu(tab.id,event.currentTarget);}}><button className="workspace-tab-label" aria-current={activeId===tab.id?"page":undefined} onClick={()=>{setMenu(null);onActivate(tab);}} title={tab.label}>{tab.label}</button><button className="workspace-tab-menu-toggle" aria-label={`页面操作 ${tab.label}`} aria-expanded={menu?.id===tab.id} aria-haspopup="menu" onClick={event=>menu?.id===tab.id?setMenu(null):showMenu(tab.id,event.currentTarget)}><MoreHorizontal size={13}/></button><button className="workspace-tab-close" aria-label={`关闭 ${tab.label}`} onClick={()=>{setMenu(null);onCloseMany([tab.id]);}}><X size={14}/></button></div>)}</div>
    {!!tabs.length&&<button className="workspace-close-all" title={`关闭全部页面（最多 ${MAX_OPEN_TABS} 个）`} aria-label="关闭全部页面" onClick={()=>{setMenu(null);onCloseMany(tabs.map(tab=>tab.id));}}><X size={15}/><span>{tabs.length}/{MAX_OPEN_TABS}</span></button>}
    {menu&&<div className="workspace-tab-dropdown" role="menu" aria-label="页面关闭操作" style={{left:menu.x}}><button role="menuitem" onClick={()=>close("all")}>关闭全部</button><button role="menuitem" disabled={tabIdsToClose(tabs,menu.id,"left").length===0} onClick={()=>close("left")}>关闭左侧</button><button role="menuitem" disabled={tabIdsToClose(tabs,menu.id,"right").length===0} onClick={()=>close("right")}>关闭右侧</button><button role="menuitem" disabled={tabs.length<2} onClick={()=>close("others")}>关闭其他</button></div>}
  </div>;
}
