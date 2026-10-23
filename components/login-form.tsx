"use client";
import {useState,type FormEvent} from "react";
import {ArrowRight,Library,ShieldCheck,Sparkles,Users} from "lucide-react";
import {api} from "@/lib/client-api";
import {formatLoginAccount} from "@/lib/login-account";
import {BrandLogo} from "./brand-logo";
import type {CatalogData,SafeUser} from "@/lib/resource-types";

export function LoginForm({ onSuccess, ready }: { ready: boolean; onSuccess: (user: SafeUser, catalog: CatalogData) => void }) {
  const [email, setEmail] = useState(""); const [key, setKey] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),20000);
    try { const data = await api<{ user: SafeUser } & CatalogData>("/api/auth/login", { method: "POST", signal:controller.signal, body: JSON.stringify({ email, key }) }); onSuccess(data.user, data); }
    catch (err) { setError(controller.signal.aborted?"登录请求超时，请检查网络后重试；输入内容已保留。":err instanceof Error ? err.message : "登录失败"); } finally { window.clearTimeout(timeout);setBusy(false); }
  }
  return <main className="login-page" inert={!ready} aria-busy={!ready}><section className="login-visual"><BrandLogo light /><div className="login-copy"><span className="eyebrow light">CONNECT IDEAS. EMPOWER OPERATIONS.</span><h1><span>好方法，值得</span><span>被整个团队<em>看见。</em></span></h1><p>汇集海外渠道运营的 AI 资源、实用工具与团队经验，让每一份成果都能被发现、被复用。</p><div className="story-flow"><div className="flow-heading">从个人探索，到团队的共同资源</div><div className="flow-steps"><div className="flow-node"><span><Sparkles size={20} /></span>创造好方法</div><ArrowRight className="flow-arrow" size={16} /><div className="flow-node"><span><Library size={20} /></span>分享资源</div><ArrowRight className="flow-arrow" size={16} /><div className="flow-node"><span><Users size={20} /></span>一起用起来</div></div></div></div><div className="story-footer">DIDATRAVEL · 海外渠道线上运营部 · 2026</div></section><section className="login-panel"><form className="login-card" onSubmit={submit}><div className="mobile-brand"><BrandLogo /><b>Dida 海外渠道 工作台</b></div><div className="login-mark"><Sparkles size={22} /></div><span className="eyebrow">YOUR TEAM RESOURCE HUB</span><h2>进入 工作台</h2><p>使用登录账号和 Access Key，查看团队已经沉淀的资源与成果。</p><label>登录账号<input disabled={!ready || busy} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(formatLoginAccount(e.target.value))} placeholder="Name@dida.com" required /></label><label>Access Key<input disabled={!ready || busy} type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="输入你的个人访问密钥" required /></label>{error && <div className="form-error">{error}</div>}<button className="login-button" disabled={!ready || busy}>{busy ? "正在验证…" : "进入工作台总览"}<ArrowRight size={18} /></button><div className="login-security"><ShieldCheck size={16} /><span>访问密钥决定你的查看、创建或管理权限</span></div></form></section></main>;
}
