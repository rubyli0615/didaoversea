"use client";
import {lazy,Suspense,useEffect,useState} from "react";
import {LoginForm} from "./login-form";
import {PageErrorBoundary} from "./page-error-boundary";
import type {CatalogData,SafeUser} from "@/lib/resource-types";

const WorkspaceApp=lazy(()=>import("./workspace-app").then(module=>({default:module.WorkspaceApp})));
// Anonymous visits do not download the authenticated workspace before successful sign-in.
export function LoginScreen(){
 const [ready,setReady]=useState(false),[session,setSession]=useState<{user:SafeUser;catalog:CatalogData}|null>(null);
 useEffect(()=>setReady(true),[]);
 return session?<PageErrorBoundary resetKey={session.user.id} onBack={()=>setSession(null)} backLabel="返回登录" message="登录已验证，但工作台资源暂时无法加载。可能是网络中断或旧页面资源失效；请恢复网络后手动刷新，登录状态会保留，网站不会自动刷新。"><Suspense fallback={<main className="loading-screen" role="status">正在打开工作台…</main>}><WorkspaceApp initialUser={session.user} initialCatalog={session.catalog}/></Suspense></PageErrorBoundary>:<LoginForm ready={ready} onSuccess={(user,catalog)=>setSession({user,catalog})}/>;
}
