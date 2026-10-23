import {env} from "cloudflare:workers";
import {and,count,eq,gte,lt} from "drizzle-orm";
import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {getDb} from "@/db";
import {analysisRuns,resources} from "@/db/schema";
import {validateAnalysisInput} from "@/lib/analysis-contract";
import {AnalysisError,readBoundedJson} from "@/lib/personal-data-mcp";
import {collectAnalysis,explainAnalysis} from "@/lib/online-analysis";
export async function POST(request:Request){
 const actor=await getCurrentUser(),headers={"Cache-Control":"private, no-store"};
 const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,code},{status,headers});
 if(!actor)return fail("请先登录。",401);
 if(![new URL(request.url).origin,"https://dida-ai-capability-hub.equalibis256.chatgpt.site"].includes(request.headers.get("origin")??""))return fail("仅支持本站主动提交分析。",403);
 if(request.headers.get("content-type")?.split(";")[0]!=="application/json")return fail("请求格式不支持。",415);
 // Never record request bodies: they contain the caller's temporary data credential.
 if(Number(request.headers.get("content-length")??0)>12000)return fail("请求内容过大。",413);
 let body:Record<string,unknown>,input;
 try{body=await readBoundedJson(new Response(request.body,{headers:{"Content-Type":"application/json"}}),request.signal,12000);input=validateAnalysisInput(body);}catch{return fail("请检查 ClientID、分析日期、窗口和指标。",400);}
 if(body.consent!==true)return fail("请先确认数据授权及提交 DeepSeek 分析。",400);
 if(typeof body.dataKey!=="string"||body.dataKey.length<8||body.dataKey.length>4096||/[\r\n]/.test(body.dataKey))return fail("请填写本人 data-mcp 的有效连接凭据。",400);
 if(typeof body.requestId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.requestId))return fail("请求标识无效，请重新开始。",400);
 if(!env.DEEPSEEK_API_KEY)return fail("管理员尚未配置 DeepSeek 服务端密钥。",503,"MODEL_NOT_CONFIGURED");
 const db=getDb(),resource=(await db.select({id:resources.id,slug:resources.slug,status:resources.status,ownerId:resources.ownerId}).from(resources).where(eq(resources.id,String(body.resourceId??""))).limit(1))[0];
 if(!resource||resource.slug!=="attribution-analysis"||resource.status==="ARCHIVED"||resource.status!=="PUBLISHED"&&resource.ownerId!==actor.id&&actor.role!=="ADMIN")return fail("资源不可用或无访问权限。",403);
 const now=Math.floor(Date.now()/1000);
 await db.update(analysisRuns).set({status:"FAILED",updatedAt:now}).where(and(eq(analysisRuns.userId,actor.id),eq(analysisRuns.status,"RUNNING"),lt(analysisRuns.createdAt,now-240)));
 if((await db.select({id:analysisRuns.id}).from(analysisRuns).where(eq(analysisRuns.id,body.requestId)).limit(1))[0])return fail("该请求已提交，请勿重复运行。",409);
 const used=(await db.select({n:count()}).from(analysisRuns).where(and(eq(analysisRuns.userId,actor.id),gte(analysisRuns.createdAt,now-86400))))[0].n;
 if(used>=10)return fail("每人 24 小时最多运行 10 次，请稍后再试。",429,"DAILY_LIMIT");
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,request.signal,AbortSignal.timeout(150000)]);
 try{await db.insert(analysisRuns).values({id:body.requestId,userId:actor.id,status:"RUNNING",createdAt:now,updatedAt:now});}catch{return fail("已有分析正在运行，请等待完成。",409,"ALREADY_RUNNING");}
 let dataKey=body.dataKey;delete body.dataKey;
 const runId=body.requestId;
 const stream=new ReadableStream({
  start(output){
   const send=(value:object)=>{if(!signal.aborted)output.enqueue(new TextEncoder().encode(JSON.stringify(value)+"\n"));};
   void(async()=>{
    let status:"SUCCEEDED"|"FAILED"|"CANCELLED"="FAILED";
    try{
     send({type:"progress",message:"正在连接本人 data-mcp 并核验指标口径…"});
     const report=await collectAnalysis(input,dataKey,signal,message=>send({type:"progress",message}));
     dataKey="";
     send({type:"progress",message:"授权数据已读取，正在由 DeepSeek 分析…"});
     const model=env.DEEPSEEK_MODEL||"deepseek-flash";
     if(!["deepseek-flash","deepseek-v4-pro"].includes(model))throw new AnalysisError("模型配置不支持，请联系管理员。");
     const analysis=await explainAnalysis(input,report,env.DEEPSEEK_API_KEY!,model,signal);
     status="SUCCEEDED";
     send({type:"result",report,analysis,model,generatedAt:new Date().toISOString()});
    }catch(error){
     status=signal.aborted?"CANCELLED":"FAILED";
     // Never forward arbitrary upstream messages, tokens, SQL errors or request headers.
     send({type:"error",message:signal.aborted?"分析已取消或超时，未生成结论。":error instanceof AnalysisError?error.message:"服务连接失败，请稍后重试；未生成分析结论。",code:error instanceof AnalysisError?error.code:"CONNECTION_FAILED"});
    }finally{
     dataKey="";
     await db.update(analysisRuns).set({status,updatedAt:Math.floor(Date.now()/1000)}).where(and(eq(analysisRuns.id,runId),eq(analysisRuns.userId,actor.id))).catch(()=>{});
     try{output.close();}catch{/* Caller disconnected. */}
    }
   })();
  },cancel(){controller.abort();}
 });
 return new Response(stream,{headers:{...headers,"Content-Type":"application/x-ndjson; charset=utf-8","X-Content-Type-Options":"nosniff","X-Accel-Buffering":"no"}});
}
