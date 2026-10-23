// Isolated local verification for SSR loading, stable chrome, generic resources and MCP tables.
import assert from "node:assert/strict";
import { randomUUID,randomBytes,createHash } from "node:crypto";
import { readdirSync,mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const origin=process.env.SITE_QA_ORIGIN??"http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url);
const dbPath=new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir);
let db=new DatabaseSync(dbPath);db.exec("PRAGMA busy_timeout=10000");
function openDb(){if(!db.isOpen){db=new DatabaseSync(dbPath);db.exec("PRAGMA busy_timeout=10000");}}
const sessions=[],resources=new Set(),errors=[],suffix=randomUUID().slice(0,8);let checks=0;
const browser=await chromium.launch({channel:"chrome",headless:true,args:["--disable-features=OverlayScrollbar"]});
const check=(condition,label)=>{assert(condition,label);checks++;};
async function client(userId,js=true){
 openDb();
 const id=randomUUID(),token=randomBytes(32).toString("hex"),now=Math.floor(Date.now()/1000);sessions.push(id);
 db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(id,userId,createHash("sha256").update(token).digest("hex"),now+1200,now);db.close();
 const context=await browser.newContext({viewport:{width:1600,height:1000},javaScriptEnabled:js});
 await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);
 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 page.on("response",async r=>{if(r.status()===201&&r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/resources")resources.add((await r.json()).id);});
 return {context,page};
}
async function api(client,path,method="GET",data,status=200){
 const cookies=(await client.context.cookies()).map(cookie=>cookie.name+"="+cookie.value).join(";");
 const response=await fetch(origin+path,{method,headers:{"Content-Type":"application/json",Cookie:cookies,Origin:origin,Referer:origin+"/"},...(data?{body:JSON.stringify(data)}:{})});const raw=await response.text();check(response.status===status,path+" "+response.status+" "+raw.slice(0,500));
 const result=JSON.parse(raw);if(status===201)resources.add(result.id);return result;
}
const nav=(page,name)=>page.locator(".sidebar").getByRole("button",{name,exact:true}).click();
try{
 const noJs=await client("usr-lumino",false);await noJs.page.goto(origin);
 check(await noJs.page.locator(".resource-card").count()>0,"authenticated catalog rendered without JavaScript");
 const anonymous=await browser.newContext({javaScriptEnabled:false}),anon=await anonymous.newPage();await anon.goto(origin);
 check(await anon.locator('input[type="email"]').isVisible(),"login form rendered without JavaScript");
 check(await anon.locator('input[type="email"]').inputValue()==="","login account stays blank");
 const creator=await client("usr-lumino"),viewer=await client("usr-william"),admin=await client("usr-ruby"),page=creator.page,requests=[];
 page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))requests.push(r.url());});
 const initial=await page.goto(origin);await page.locator(".resource-card").first().waitFor();
 check(initial.status()===200,"SSR page loads");
 await page.waitForLoadState("networkidle");
 const startupApiRequests=requests.length;
 check(!requests.some(url=>url.includes("/api/auth/session")||url.includes("/api/resources")),"no startup auth/catalog HTTP waterfall");
 const fullResponse=await creator.context.request.get(origin+"/api/resources"),full=await fullResponse.text();
 const summaryResponse=await creator.context.request.get(origin+"/api/resources?summary=1"),summary=await summaryResponse.text(),etag=summaryResponse.headers()["etag"];
 check(Buffer.byteLength(summary)<Buffer.byteLength(full)*.65,"catalog payload reduced by more than 35%");
 const summaryData=JSON.parse(summary);check(summaryData.resources.every(r=>r.isSummary&&!Object.hasOwn(r,"installationCommand")&&!Object.hasOwn(r,"dataPermissions")),"long detail fields excluded from catalog");
 const unchanged=await creator.context.request.get(origin+"/api/resources?summary=1",{headers:{"If-None-Match":etag}});
 check(unchanged.status()===304&&(await unchanged.body()).length===0,"unchanged catalog is bodyless 304");
 let detailRequests=0;page.on("request",r=>{if(/\/api\/resources\/[^/?]+\/detail$/.test(new URL(r.url()).pathname)&&r.method()==="GET")detailRequests++;});
 await nav(page,"Data MCP");await page.locator(".mcp-data-section").waitFor();
 check(detailRequests===1,"first detail loaded once on demand");
 check(JSON.stringify(await page.locator(".resource-page-layout>main>section>h2,.resource-page-layout>main>section>details>summary").evaluateAll(nodes=>nodes.map(n=>n.childNodes[0].textContent.trim())))===JSON.stringify(["接入方式","工具清单","可访问数据"]),"MCP contains only requested three content sections");
 check(await page.locator(".mcp-tools-section tbody tr").count()===6,"six owner-provided Data tools in table");
 check(await page.locator(".mcp-data-section tbody tr").count()===37,"all 37 Data candidate tables in table");
 check(await page.locator(".mcp-evidence-note").count()===0,"table footer removed");
 await nav(page,"Skills");await nav(page,"Data MCP");await page.locator(".mcp-data-section").waitFor();
 check(detailRequests===1,"reopening unchanged detail uses in-memory cache");
 await nav(page,"Tiger MCP");await page.locator(".mcp-tools-section").waitFor();
 check(await page.locator(".mcp-tools-section tbody tr").count()===3,"Tiger tools table");
 check(await page.locator(".resource-side").getByRole("link",{name:"查看使用文档",exact:true}).getAttribute("href")==="https://didatravel.feishu.cn/wiki/BU1Xw57h0iaGkek9FgncCVbTnDh","Tiger documentation preserved");
 await page.context().grantPermissions(["clipboard-read","clipboard-write"]);
 await page.getByRole("button",{name:"复制安装指令",exact:true}).click();
 check((await page.evaluate(()=>navigator.clipboard.readText())).includes('"tiger_user_key": "你的个人鉴权key"'),"verbatim Tiger setup still copyable from sidebar");
 mkdirSync("outputs/browser-qa",{recursive:true});await page.screenshot({path:"outputs/browser-qa/mcp-tables-v37.png",fullPage:true});
 await nav(page,"Skills");await page.locator(".resource-card").filter({hasText:"产量异动归因 Skill"}).click();await page.locator(".permission-disclosure").waitFor();
 check((await page.locator(".permission-disclosure>summary").innerText()).startsWith("所需数据表")&&!(await page.locator(".permission-disclosure>summary").innerText()).includes("视图"),"Skill table heading simplified");
 await nav(page,"其他");await page.getByRole("button",{name:"创建资源",exact:true}).click();await page.locator(".other-resource-editor").waitFor();
 check(JSON.stringify(await page.locator(".other-resource-editor input[name],.other-resource-editor textarea[name]").evaluateAll(nodes=>nodes.map(n=>n.name)))===JSON.stringify(["scenario","name","sourceUrl","detail"]),"Other form has exactly four fields");
 await page.locator('input[name="scenario"]').fill("模板");
 await page.locator('input[name="name"]').fill("四字段资源-"+suffix);await page.locator('input[name="sourceUrl"]').fill("https://example.com/template");
 await page.locator('textarea[name="detail"]').fill("这是模板资源的使用说明。");
 const save=page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/resources");
 await page.getByRole("button",{name:"保存资源",exact:true}).click();const saved=await save;check(saved.status()===201,"four-field creation succeeds");
 const id=(await saved.json()).id;resources.add(id);
 const own=await api(creator,"/api/resources/"+id+"/detail");check(own.resource.type==="OTHER"&&own.resource.resourceModule==="other"&&own.resource.version===null,"Other is not Skill/MCP/Agent/website, no version required");
 const privateHtml=await (await viewer.context.request.get(origin+"/")).text();check(!privateHtml.includes("四字段资源-"+suffix),"SSR does not leak another author’s draft");
 // Privacy is verified by SSR above; detail privacy is checked after editing below.
 await api(viewer,"/api/resources","POST",{type:"OTHER",name:"forbidden",scenario:"模板",sourceUrl:"https://example.com",detail:"说明"},403);
 await api(creator,"/api/resources/"+id,"PUT",{detail:"先验证有效保存"});
 await api(creator,"/api/resources/"+id,"PUT",{sourceUrl:"javascript:alert(1)"},400);
 await api(creator,"/api/resources/"+id,"PUT",{scenario:" "},400);
 await api(viewer,"/api/resources/"+id+"/detail","GET",undefined,404);
 await api(admin,"/api/resources/"+id,"PUT",{status:"PUBLISHED"});
 await api(creator,"/api/resources/"+id,"PUT",{detail:"已更新的使用说明"});
 await page.locator(".resource-card").filter({has:page.getByRole("heading",{name:"四字段资源-"+suffix,exact:true})}).click();
 await page.getByRole("heading",{name:"使用说明",exact:true}).waitFor();
 check(await page.getByRole("link",{name:"打开资源链接",exact:true}).getAttribute("href")==="https://example.com/template","Other detail exposes resource link");
 await page.screenshot({path:"outputs/browser-qa/other-detail-v37.png",fullPage:true});
 await page.getByRole("button",{name:"编辑资源",exact:true}).click();await page.locator(".other-resource-editor").waitFor();
 check((await page.locator('textarea[name="detail"]').inputValue())==="已更新的使用说明","editing fetches current complete detail");
 await page.getByRole("button",{name:"取消",exact:true}).click();
 const invalid=await api(creator,"/api/resources","POST",{type:"OTHER",name:"missing",scenario:"模板",detail:"说明"},400);
 // Fill all eight tabs so the right edge must stay anchored while directory height changes.
 for(const name of ["Tiger MCP","Data MCP","Skills","海外渠道资源","DIDA AI资源","其他","我创建的","海外OP常用网站"])await nav(page,name);
 await page.locator(".website-category-toggle").first().waitFor();check(await page.locator(".workspace-tab").count()===8,"stress header at eight tabs");
 const bounds=async()=>page.evaluate(()=>Object.fromEntries([".workspace-close-all",".notification-center",".topbar-actions",".workspace-header"].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x,y:r.y,w:r.width,h:r.height}];})));
 const before=await bounds();
 for(const button of await page.locator(".website-category-toggle").all())await button.click();
 const after=await bounds();
 check(Object.keys(before).every(key=>["x","y","w","h"].every(field=>Math.abs(before[key][field]-after[key][field])<1)),"header controls do not shift when all categories collapse");
 for(const button of await page.locator(".website-category-toggle").all())await button.click();
 const reopened=await bounds();check(Object.keys(before).every(key=>Math.abs(before[key].x-reopened[key].x)<1&&Math.abs(before[key].y-reopened[key].y)<1),"header controls remain anchored on expansion");
 await page.screenshot({path:"outputs/browser-qa/stable-header-v37.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});await nav(page,"其他");await page.getByRole("button",{name:"创建资源",exact:true}).click();await page.locator(".other-resource-editor").waitFor();
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"four-field form fits phone");
 await page.screenshot({path:"outputs/browser-qa/other-form-mobile-v37.png",fullPage:true});
 check(errors.length===0,"no browser exceptions: "+errors.join(";"));
 console.log(JSON.stringify({checks,payloadBytes:{full:Buffer.byteLength(full),summary:Buffer.byteLength(summary),reductionPercent:Math.round((1-Buffer.byteLength(summary)/Buffer.byteLength(full))*100)},startupApiRequests,browserErrors:errors}));
}finally{
 await browser.close();openDb();
 for(const id of resources){db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(id);db.prepare("DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?").run(id,id);db.prepare("DELETE FROM resources WHERE id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);}
 for(const id of sessions)db.prepare("DELETE FROM sessions WHERE id=?").run(id);db.close();
}
