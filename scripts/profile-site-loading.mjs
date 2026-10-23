// Read-only production loading timings; local comparisons use temporary sessions only.
import { performance } from "node:perf_hooks";
const origin=process.argv[2]??"https://dida-ai-capability-hub.equalibis256.chatgpt.site";
for(const path of ["/","/api/auth/session","/api/resources","/"]){
 const start=performance.now(),response=await fetch(origin+path),text=await response.text();
 console.log(JSON.stringify({path,status:response.status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text),serverTiming:response.headers.get("server-timing"),encoding:response.headers.get("content-encoding")}));
 if(path==="/")for(const match of text.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)){
  const url=new URL(match[1],origin);if(url.origin!==origin)continue;
  const t=performance.now(),r=await fetch(url),body=await r.arrayBuffer();console.log(JSON.stringify({asset:url.pathname,ms:Math.round(performance.now()-t),bytes:body.byteLength,encoding:r.headers.get("content-encoding")}));
 }
}
