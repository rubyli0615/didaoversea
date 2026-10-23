export const MAX_OPEN_TABS = 8;
export type ViewId = "home" | "map" | "all" | "SKILL" | "MCP" | "AGENT" | "INTERNAL" | "OTHER" | "updates" | "mine" | "guide" | "admin";
export type WorkspaceTab = { id: string; label: string; view: ViewId; scope?: string; resourceId?: string };
export type TabCloseMode = "all" | "left" | "right" | "others";
export function addWorkspaceTab(tabs: WorkspaceTab[], tab: WorkspaceTab, activeId: string) {
  if (tabs.some(item=>item.id===tab.id)) return tabs;
  if (tabs.length < MAX_OPEN_TABS) return [...tabs,tab];
  const remove=tabs.find(item=>item.id!==activeId)?.id??tabs[0].id;
  return [...tabs.filter(item=>item.id!==remove),tab];
}
export function tabIdsToClose(tabs: WorkspaceTab[], id: string, mode: TabCloseMode) {
  const index=tabs.findIndex(tab=>tab.id===id);
  if(mode==="all")return tabs.map(tab=>tab.id);
  if(index<0)return [];
  return tabs.filter((tab,i)=>mode==="left"?i<index:mode==="right"?i>index:tab.id!==id).map(tab=>tab.id);
}
