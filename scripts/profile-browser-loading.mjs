// Read-only anonymous production-build profile; no credentials or business data.
import {chromium} from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 const page=await browser.newPage(),scripts=[],pending=[];
 page.on("response",response=>{if(response.request().resourceType()==="script")pending.push((async()=>{scripts.push({path:new URL(response.url()).pathname,bytes:(await response.body()).length});})());});
 const start=performance.now();await page.goto(process.argv[2]??"http://127.0.0.1:8787");await page.getByRole("button",{name:"进入工作台总览",exact:true}).waitFor();await page.waitForLoadState("networkidle");await Promise.all(pending);
 console.log(JSON.stringify({label:process.argv[3]??"browser",readyMs:Math.round(performance.now()-start),scriptBytes:scripts.reduce((n,s)=>n+s.bytes,0),scripts:scripts.sort((a,b)=>b.bytes-a.bytes)}));
}finally{await browser.close();}
