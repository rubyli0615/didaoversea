"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Play,Square,ShieldCheck} from "lucide-react";
import {analysisCommand,analysisWindow,type AnalysisInput} from "@/lib/analysis-contract";
import {CommandBlock} from "./command-block";
type Result={analysis:string;model:string;generatedAt:string;report:{scope:{currentStart:string;currentEnd:string;compareStart:string;compareEnd:string};boundary:string;evidence:{metric:string;basis:string;source:string;current:number;previous:number;change:number;rate:number|null}[]}};
export function SkillAnalysis({resourceId}:{resourceId:string}){
 const [clientId,setClientId]=useState(""),[date,setDate]=useState(""),[days,setDays]=useState<number| "">(""),[metrics,setMetrics]=useState<AnalysisInput["metrics"]>([]);
 const [key,setKey]=useState(""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[stage,setStage]=useState(""),[error,setError]=useState(""),[result,setResult]=useState<Result|null>(null),[elapsed,setElapsed]=useState(0);
 const running=useRef<AbortController|null>(null);
 useEffect(()=>{const clear=()=>{setKey("");running.current?.abort();};window.addEventListener("pagehide",clear);return()=>{window.removeEventListener("pagehide",clear);running.current?.abort();};},[]);
 useEffect(()=>{if(!busy)return;const id=setInterval(()=>setElapsed(value=>value+1),1000);return()=>clearInterval(id);},[busy]);
 const validPreview=Boolean(clientId.trim()&&date&&days&&metrics.length),input={clientId:clientId.trim(),date,days:Number(days),metrics},period=validPreview?analysisWindow(input):null;
 async function start(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const controller=new AbortController();running.current=controller;
  setBusy(true);setError("");setResult(null);setElapsed(0);setStage("正在提交分析…");
  const dataKey=key;setKey("");
  try{
   const response=await fetch("/api/analysis",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,resourceId,dataKey,consent,requestId:crypto.randomUUID()})});
   if(!response.ok){const body=await response.json() as {error?:string};throw Error(body.error||"无法开始分析。");}
   const reader=response.body?.getReader();if(!reader)throw Error("分析响应为空。");
   const decoder=new TextDecoder();let buffer="",finished=false;
   try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>200000)throw Error("结果过大，请缩小查询范围。");const lines=buffer.split("\n");buffer=lines.pop()??"";for(const line of lines){if(!line.trim())continue;const message=JSON.parse(line);if(message.type==="progress")setStage(message.message);else if(message.type==="result"){setResult(message);setStage("分析完成");finished=true;}else if(message.type==="error")throw Error(message.message);}}if(!finished)throw Error("分析连接中断，未收到完整结果，请重试。");}
   finally{await reader.cancel().catch(()=>{});}
  }catch(err){setStage("");setError(controller.signal.aborted?"已取消本次分析；正在执行的上游请求可能仍需短暂时间结束。":err instanceof Error?err.message:"分析失败。");}
  finally{running.current=null;setBusy(false);}
 }
 return <div className="skill-analysis">
  <header><h3>在线分析 <span>初查版 · DeepSeek</span></h3><p>填写渠道和日期，读取本人授权数据后生成指标分析。当前仅做指标对比，不等同于完整 Skill 的配置、查价、验价深度归因。</p></header>
  <form onSubmit={start}>
   <fieldset disabled={busy}><legend>1 · 确认分析范围</legend><div className="analysis-input-grid"><label>渠道 / ClientID<input required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" value={clientId} onChange={event=>{setClientId(event.target.value);setResult(null);}} placeholder="输入准确 ClientID，例如 Agoda"/></label><label>分析日期<input type="date" required min="2020-01-01" max={new Date(Date.now()+8*3600000-86400000).toISOString().slice(0,10)} value={date} onChange={event=>{setDate(event.target.value);setResult(null);}}/></label><label>当前期窗口<select aria-label="当前期窗口" required value={days} onChange={event=>{setDays(Number(event.target.value));setResult(null);}}><option value="" disabled>请选择分析窗口</option><option value={1}>1 天，与上周同日对比</option><option value={7}>7 天，与上周同期对比</option></select></label></div>
    <div className="analysis-metrics" role="group" aria-label="分析指标">{(["BKS","TTV","GP"] as const).map(metric=><label key={metric}><input type="checkbox" checked={metrics.includes(metric)} onChange={event=>{setMetrics(current=>event.target.checked?[...current,metric]:current.filter(item=>item!==metric));setResult(null);}}/>{metric}{metric==="GP"?"（离店 CNY）":metric==="TTV"?"（创建日 CNY）":"（创建日）"}</label>)}</div>
    {period&&<p className="analysis-window">当前期：{period.currentStart}～{period.currentEnd}；对比期：{period.compareStart}～{period.compareEnd}。自动排除今天未完结的数据。</p>}
   </fieldset>
   <fieldset disabled={busy}><legend>2 · 使用本人已授权的数据连接</legend><label>data-mcp 连接凭据（agent_user_key）<input type="password" value={key} onChange={event=>setKey(event.target.value)} required minLength={8} maxLength={4096} autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true" placeholder="仅用于本次查询，不保存"/></label><p><ShieldCheck size={14}/>此处不是 DeepSeek Key，也不是工作台登录 Key。仅在请求期间用于本人 data-mcp 鉴权，不保存、不提交给模型。</p>
    <label className="analysis-consent"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/>我确认有权将本次本人可见的汇总数据提交至 DeepSeek 分析。</label>
   </fieldset>
   <div className="analysis-controls"><button className="primary-button" disabled={busy||!metrics.length}><Play size={16}/>{busy?"分析中…":"开始分析"}</button>{busy&&<button type="button" className="secondary-button" onClick={()=>running.current?.abort()}><Square size={14}/>取消分析</button>}<span role="status">{stage}{busy?" · "+elapsed+" 秒":""}</span></div><p className="analysis-limit">单次最长约 150 秒，每人 24 小时最多 10 次。实际可见数据由本人 data-mcp 权限决定，不因 Creator 身份扩大。结果仅保留在当前页面。</p>
  </form>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {result&&<section className="analysis-result" aria-label="在线分析结果"><h3>分析结果</h3><p>{result.model} · {new Date(result.generatedAt).toLocaleString("zh-CN")} · 本人权限范围内</p><div className="permission-table-scroll"><table className="permission-table"><thead><tr><th>指标 / 口径</th><th>本期</th><th>对比期</th><th>差额</th><th>变化率</th></tr></thead><tbody>{result.report.evidence.map(row=><tr key={row.metric}><td>{row.metric}<small>{row.basis}</small></td><td>{row.current.toLocaleString("zh-CN")}</td><td>{row.previous.toLocaleString("zh-CN")}</td><td>{row.change.toLocaleString("zh-CN")}</td><td>{row.rate===null?"基数为 0，不计算":(row.rate*100).toFixed(2)+"%"}</td></tr>)}</tbody></table></div><CommandBlock variant="text" text={result.analysis} label="DeepSeek 分析" copyLabel="复制分析结果"/><p className="analysis-boundary">{result.report.boundary}</p><details><summary>数据来源与口径</summary>{result.report.evidence.map(row=><p key={row.metric}>{row.metric}：{row.source} · {row.basis}</p>)}</details></section>}
  {validPreview?<details className="analysis-command-preview"><summary>查看生成的使用指令（也可复制到 AI 客户端）</summary><CommandBlock text={analysisCommand(input)} label="使用指令" copyLabel="复制使用指令"/></details>:<p className="analysis-limit">填写完整参数后，可查看并复制生成的使用指令。</p>}
 </div>;
}
