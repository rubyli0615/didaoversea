// Request-scoped connection only. Never cache sessions or credentials across visitors.
const ENDPOINT="https://data-api-mcp.didaadmin.com/mcp/v1/query";
type ObjectValue=Record<string,unknown>;
export class AnalysisError extends Error {constructor(message:string,public code="ANALYSIS_FAILED"){super(message);}}
export async function readBoundedJson(response:Response,signal:AbortSignal,max=1024*1024,id?:number):Promise<ObjectValue>{
 const reader=response.body?.getReader();if(!reader)throw new AnalysisError("服务返回空响应。");
 let buffer="",size=0;const decoder=new TextDecoder(),sse=response.headers.get("content-type")?.includes("text/event-stream");
 try{for(;;){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new AnalysisError("服务结果过大，请缩小查询范围。","RESULT_TOO_LARGE");buffer+=decoder.decode(value,{stream:true});
   if(sse){const events=buffer.split(/\r?\n\r?\n/);buffer=events.pop()??"";for(const event of events){const text=event.split(/\r?\n/).filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trimStart()).join("\n");if(!text||text==="[DONE]")continue;const item=JSON.parse(text);if(id!==undefined&&item.id===id)return item;}}
 }if(sse)throw new AnalysisError("MCP 事件流未返回完整结果。");return JSON.parse(buffer);}
 finally{await reader.cancel().catch(()=>{});}
}
export function unwrapTool(result:ObjectValue):ObjectValue{
 if(result.isError)throw new AnalysisError("data-mcp 拒绝了此次查询，请检查本人表权限。","DATA_PERMISSION_OR_QUERY");
 let data=result.structuredContent;
 if(data===undefined&&Array.isArray(result.content)){const block=result.content.find((x:unknown)=>x&&typeof x==="object"&&(x as ObjectValue).type==="text");if(block){try{data=JSON.parse(String((block as ObjectValue).text));}catch{throw new AnalysisError("data-mcp 未返回可核验的结构化数据。");}}}
 if(!data||typeof data!=="object"||Array.isArray(data))throw new AnalysisError("data-mcp 返回格式不支持，请联系维护人。");
 const value=data as ObjectValue;if(value.success===false||value.error)throw new AnalysisError("data-mcp 查询失败，未将失败当作零产量。","DATA_QUERY_FAILED");return value;
}
export async function personalDataMcp(key:string,signal:AbortSignal){
 let session="",version="2025-06-18",sequence=0,negotiated=false;
 async function rpc(method:string,params:ObjectValue,notification=false){
   const id=notification?undefined:++sequence;
   let response:Response;
   try{response=await fetch(ENDPOINT,{method:"POST",redirect:"error",signal,headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream",agent_user_key:key,...(session?{"Mcp-Session-Id":session}:{}),...(negotiated?{"MCP-Protocol-Version":version}:{})},body:JSON.stringify({jsonrpc:"2.0",...(id?{id}:{}),method,params})});}catch(error){if(signal.aborted)throw error;throw new AnalysisError("工作台服务器无法连接 data-mcp，请联系管理员检查服务对网站服务器的网络可达性。","DATA_CONNECTION_FAILED");}
   if(!response.ok)throw new AnalysisError(response.status===401||response.status===403?"本人 data-mcp 鉴权失败或无查询权限，请核对连接凭据和审批。":"data-mcp 暂不可用（HTTP "+response.status+"），请稍后重试。","DATA_HTTP_"+response.status);
   if(notification){await response.body?.cancel();return {};}
   if(method==="initialize")session=response.headers.get("Mcp-Session-Id")??"";
   const envelope=await readBoundedJson(response,signal,1024*1024,id);
   if(envelope.id!==id||envelope.jsonrpc!=="2.0"||envelope.error)throw new AnalysisError("data-mcp 请求失败，请检查工具版本与查询权限。","MCP_RPC_ERROR");
   return envelope.result as ObjectValue;
 }
 const initialized=await rpc("initialize",{protocolVersion:version,capabilities:{},clientInfo:{name:"dida-op-workbench",version:"1.0"}});
 if(typeof initialized?.protocolVersion!=="string"||!["2025-06-18","2025-03-26","2024-11-05"].includes(initialized.protocolVersion))throw new AnalysisError("data-mcp 协议版本暂不支持。");
 version=initialized.protocolVersion;negotiated=true;await rpc("notifications/initialized",{},true);
 const tools: ObjectValue[]=[];let cursor:unknown;
 for(let page=0;page<4;page++){const list=await rpc("tools/list",cursor?{cursor}:{});if(!Array.isArray(list.tools))throw new AnalysisError("无法读取 data-mcp 工具目录。");tools.push(...list.tools);cursor=list.nextCursor;if(!cursor)break;}
 const allowed=["search_meta_data","execute_sql","search_metrics","analyse_query"];
 return {async call(name:string,args:ObjectValue){
   if(!allowed.includes(name))throw new AnalysisError("该工具不在在线分析白名单中。");
   const tool=tools.find(t=>[name,"data-mcp_"+name,"data-mcp-"+name].includes(String(t.name)));
   if(!tool)throw new AnalysisError("本人 data-mcp 未提供 "+name+"，无法继续分析。","MISSING_DATA_TOOL");
   // Server owns every argument; no model-generated SQL or user-selected endpoints.
   return unwrapTool(await rpc("tools/call",{name:tool.name,arguments:args}));
 }};
}
