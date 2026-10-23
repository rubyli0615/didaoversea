export type AnalysisInput={clientId:string;date:string;days:number;metrics:("BKS"|"TTV"|"GP")[]};
export function validateAnalysisInput(value:unknown):AnalysisInput {
  const b=value as Record<string,unknown>|null;
  if(!b||typeof b.clientId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(b.clientId.trim()))throw Error("请输入准确的渠道 ClientID（字母、数字、点、下划线或短横线），不支持模糊名称。");
  if(typeof b.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date+"T00:00:00Z"))||typeof b.date==="string"&&new Date(b.date+"T00:00:00Z").toISOString().slice(0,10)!==b.date)throw Error("请选择有效分析日期。");
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  if(b.date<"2020-01-01"||b.date>=today)throw Error("请选择 2020 年之后、今天之前的完整业务日期。");
  if(![1,7].includes(Number(b.days)))throw Error("分析窗口仅支持 1 天或 7 天。");
  if(!Array.isArray(b.metrics)||!b.metrics.length||b.metrics.length>3||b.metrics.some(m=>!["BKS","TTV","GP"].includes(String(m)))||new Set(b.metrics).size!==b.metrics.length)throw Error("请选择有效指标。");
  return {clientId:b.clientId.trim(),date:b.date,days:Number(b.days),metrics:b.metrics as AnalysisInput["metrics"]};
}
export function dateOffset(date:string,n:number){return new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);}
export function analysisWindow(input:AnalysisInput){
  const yesterday=dateOffset(new Date(Date.now()+8*3600000).toISOString().slice(0,10),-1);
  const currentEnd=[dateOffset(input.date,input.days-1),yesterday].sort()[0],days=Math.round((Date.parse(currentEnd)-Date.parse(input.date))/86400000)+1;
  return {currentStart:input.date,currentEnd,compareStart:dateOffset(input.date,-7),compareEnd:dateOffset(input.date,days-1-7),days};
}
export function analysisCommand(input:AnalysisInput){return "使用 attribution-analysis，调查渠道/ClientID "+input.clientId+" 在 "+input.date+" 的 "+input.metrics.join("/")+" 异动；当前期 "+analysisWindow(input).currentStart+" 至 "+analysisWindow(input).currentEnd+"，对比上周同期。先核验授权数据，再分析；无证据不定责。";}
