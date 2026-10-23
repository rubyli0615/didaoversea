"use client";
export async function api<T>(url:string,options?:RequestInit):Promise<T>{
 const signal=options?.signal??AbortSignal.timeout(15000);
 try{
  const response=await fetch(url,{...options,signal,headers:{"Content-Type":"application/json",...options?.headers}});
  const data=await response.json().catch(()=>null) as (T & {error?:string})|null;
  if(!response.ok)throw Error(data?.error||`服务暂不可用（HTTP ${response.status}），请稍后重试。`);
  if(data===null)throw Error("服务返回格式异常，请稍后重试。");
  return data;
 }catch(error){
  if(signal.aborted&&!options?.signal)throw Error(options?.method&&options.method!=="GET"?"保存请求超时，请先刷新目录确认是否已保存，再决定是否重试。":"请求超时，请检查网络后重试；当前页面已保留。");
  throw error;
 }
}
