import assert from "node:assert/strict";
import {importSource} from "./ts-module-loader.mjs";
const {validateAnalysisInput,analysisWindow,analysisCommand}=await importSource("../lib/analysis-contract.ts",import.meta.url);
const {collectAnalysis,explainAnalysis}=await importSource("../lib/online-analysis.ts",import.meta.url);
const {readBoundedJson}=await importSource("../lib/personal-data-mcp.ts",import.meta.url);
let checks=0;const check=(x,label)=>{assert(x,label);checks++;};
const input=validateAnalysisInput({clientId:"Agoda",date:"2026-09-20",days:1,metrics:["BKS","TTV","GP"]});
check(analysisWindow(input).compareStart==="2026-09-13","same weekday comparison");
check(analysisCommand(input).includes("Agoda"),"parameterized prompt");
for(const changes of [{clientId:"x';DROP TABLE users;--"},{date:"2026-02-30"},{date:"2099-01-01"},{days:31},{metrics:[]},{metrics:["BKS","BKS"]},{clientId:""},{metrics:["unknown"]}]){assert.throws(()=>validateAnalysisInput({...input,...changes}));checks++;}
const original=globalThis.fetch,calls=[];let failure="",pages=false;
const fields={ "public.npd_booking_view":["channel_createdate","clientid","channel_status","rebook_sequence"],"dwd.dwd_hotel_order_channel_supplier_booking_mf":["channel_create_date","client_id","client_group_name","channel_status_code","supplier_status_code","supplier_rebook_sequence","channel_price_cny"]};
const tools=["search_meta_data","execute_sql","search_metrics","analyse_query"];
globalThis.fetch=async(url,options)=>{
 const body=options?.body?JSON.parse(options.body):{};
 calls.push({url,headers:options.headers,body});
 if(String(url).startsWith("https://api.deepseek.com/")){
  if(failure==="model401")return new Response("{}",{status:401});
  return Response.json({choices:[{message:{content:"仅基于授权汇总结果的测试分析。"},finish_reason:"stop"}]});
 }
 check(url==="https://data-api-mcp.didaadmin.com/mcp/v1/query","fixed MCP origin");
 check(options.headers.agent_user_key==="FAKE-PERSONAL-DATA-KEY","caller data key only to MCP");
 if(failure==="401")return new Response("{}",{status:401});
 if(body.method==="notifications/initialized")return new Response(null,{status:202});
 if(body.method!=="initialize")check(options.headers["Mcp-Session-Id"]==="local-session","request-local session propagated");
 let result;
 if(body.method==="initialize")result={protocolVersion:"2025-06-18",capabilities:{}};
 else if(body.method==="tools/list")result={tools:tools.map(name=>({name:"data-mcp_"+name,inputSchema:{type:"object"}}))};
 else if(body.method==="tools/call"){
  const name=body.params.name.replace("data-mcp_",""),args=body.params.arguments;
  if(name==="search_meta_data")result={tables:[{tableName:args.keyword,columns:fields[args.keyword].map(columnName=>({columnName}))}]};
  else if(name==="execute_sql"){
   check(/^SELECT /.test(args.sql)&&!args.sql.includes(";"),"SELECT-only server template");
   check(args.sql.includes("='Agoda'")&&args.sql.includes("LIMIT 15"),"scope and query bound");
   if(failure==="toolError")return Response.json({jsonrpc:"2.0",id:body.id,result:{isError:true,content:[{type:"text",text:"sensitive upstream credential must not echo"}]}});
   result={rows:[{day:"2026-09-13",value:"10"},{day:"2026-09-20",value:"15"}],total:2};
  } else if(name==="search_metrics")result={metricResults:{ORD_0001:[{code:"ORD_0001",name:"GP(*checkout-CNY)",usingAble:1}]},dimensionResults:{client_id:[{columnName:"client_id"}]}};
  else if(name==="analyse_query"){
   result={queryInfo:{status:0,queryId:"q1",hasNext:pages},tableData:{columnNames:["client_id","日期","ord_0001"].map(dataIndex=>({dataIndex,title:dataIndex})),rows:[{client_id:"Agoda",日期:"2026-09-13",ord_0001:20},{client_id:"Agoda",日期:"2026-09-20",ord_0001:30},{client_id:"OTHER-PRIVATE-CLIENT",日期:"2026-09-20",ord_0001:999}]}};
  }
  result={structuredContent:result};
 }else throw Error("Unexpected RPC");
 const envelope={jsonrpc:"2.0",id:body.id,result};
 if(body.method==="tools/list")return new Response("event: message\ndata: "+JSON.stringify(envelope)+"\n\n",{headers:{"content-type":"text/event-stream"}});
 return Response.json(envelope,{headers:body.method==="initialize"?{"Mcp-Session-Id":"local-session"}:{}});
};
try{
 const progress=[];
 const report=await collectAnalysis(input,"FAKE-PERSONAL-DATA-KEY",new AbortController().signal,x=>progress.push(x));
 check(report.evidence.length===3,"all three metrics collected");
 check(report.evidence.every(e=>e.rate===.5),"deterministic changes computed outside model");
 check(!JSON.stringify(report).includes("OTHER-PRIVATE-CLIENT"),"nonselected clients never reach report");
 check(report.boundary.includes("不")&&progress.length===3,"scope limitations and progress");
 const text=await explainAnalysis(input,report,"FAKE-MODEL-KEY","deepseek-flash",new AbortController().signal);
 check(text.includes("授权"),"model result returned");
 const modelCall=calls.find(c=>c.url.includes("api.deepseek.com"));
 check(modelCall.headers.Authorization==="Bearer FAKE-MODEL-KEY","model key goes only to model provider");
 check(!JSON.stringify(modelCall.body).includes("FAKE-PERSONAL")&&!JSON.stringify(modelCall.body).includes("OTHER-PRIVATE"),"data credential and other clients never sent to model");
 failure="401";await assert.rejects(()=>collectAnalysis(input,"FAKE-PERSONAL-DATA-KEY",new AbortController().signal,()=>{}),/鉴权失败/);checks++;
 failure="toolError";await assert.rejects(()=>collectAnalysis({...input,metrics:["BKS"]},"FAKE-PERSONAL-DATA-KEY",new AbortController().signal,()=>{}),error=>!error.message.includes("sensitive")&&error.code==="DATA_PERMISSION_OR_QUERY");checks++;
 failure="";pages=true;await assert.rejects(()=>collectAnalysis({...input,metrics:["GP"]},"FAKE-PERSONAL-DATA-KEY",new AbortController().signal,()=>{}),/安全查询上限/);checks++;
 pages=false;failure="model401";await assert.rejects(()=>explainAnalysis(input,report,"FAKE-MODEL-KEY","deepseek-flash",new AbortController().signal),/凭据无效/);checks++;
 await assert.rejects(()=>readBoundedJson(new Response("x".repeat(200)),new AbortController().signal,100),/过大/);checks++;
 console.log(JSON.stringify({onlineAnalysisUnitChecks:checks}));
}finally{globalThis.fetch=original;}
