// Temporary local fixtures only; never reads or modifies production accounts/data.
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {readdirSync,mkdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {chromium} from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const origin="http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec("PRAGMA busy_timeout=10000");
const sid=randomUUID(),token=randomBytes(32).toString("hex"),now=Math.floor(Date.now()/1000),resources=[],websites=[];
db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(sid,"usr-lumino",createHash("sha256").update(token).digest("hex"),now+1800,now);
const browser=await chromium.launch({channel:"chrome",headless:true});let checks=0;
const check=(ok,label)=>{assert(ok,label);checks++;};
try{
 const context=await browser.newContext({viewport:{width:1440,height:950}});
 await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);
 const call=async(path,method="GET",data,status=200)=>{const response=await context.request.fetch(origin+path,{method,...(data?{data}:{})}),body=await response.json();check(response.status()===status,method+path+JSON.stringify(body));return body;};
 const first={teamId:"data",name:"圆标QA cloudflare",description:"测试域名管理的功能说明，不是网址",url:"https://example.com/shortcut-local"};
 const website=await call("/api/team-websites","POST",first,201);websites.push(website.id);
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.locator(".workspace-shell:not([inert])").waitFor();
 await page.locator(".sidebar").getByRole("button",{name:"网站",exact:true}).click();
 const overview=page.locator(".website-overview-group").filter({has:page.getByRole("heading",{name:/^其他有用网站/})});
 const shortcut=overview.getByRole("link",{name:first.name,exact:true});await shortcut.waitFor();
 check(await overview.locator(".website-resource-card").count()===0,"other-useful overview has no website cards");
 check(await shortcut.locator(".shortcut-circle").textContent()==="圆","shortcut uses first Chinese character");
 check(await shortcut.getAttribute("title")===first.description,"hover shows purpose not URL");
 check(await shortcut.getAttribute("href")===first.url&&await shortcut.getAttribute("target")==="_blank","shortcut opens actual website in a separate tab");
 check((await shortcut.getAttribute("rel")).includes("noopener"),"external shortcut protected");
 const style=locator=>locator.locator(".shortcut-circle").evaluate(n=>{const s=getComputedStyle(n);return [s.width,s.height,s.color,s.backgroundColor,s.fontSize];});
 const overviewStyle=await style(shortcut);check(overviewStyle[0]===overviewStyle[1]&&overviewStyle[2]==="rgb(255, 255, 255)","white letter inside a circular shortcut");
 check(await page.locator(".website-overview-group").filter({has:page.getByRole("heading",{name:/^海外OP常用网站/})}).locator(".website-resource-card").count()>0,"OP cards unchanged");
 mkdirSync("outputs/browser-qa",{recursive:true});await overview.screenshot({path:"outputs/browser-qa/website-shortcuts-v46-desktop.png"});
 await page.locator(".catalog-toolbar .searchbox input").fill("not-a-real-name-"+randomUUID());
 check(await page.locator(".website-overview-group .website-shortcut").count()===0,"overview shortcut obeys search");
 await page.locator(".catalog-toolbar .searchbox input").fill("");
 await overview.getByRole("button",{name:"查看与管理",exact:true}).click();
 const directory=page.locator(".team-websites-page"),sameLink=directory.getByRole("link",{name:first.name,exact:true});await sameLink.waitFor();
 check(JSON.stringify(await style(sameLink))===JSON.stringify(overviewStyle),"overview and actual directory share circle dimensions, font and colors");
 check(await sameLink.getAttribute("title")===first.description,"directory uses same functional tooltip");
 const groupToggle=directory.getByRole("button",{name:/^AI&项目组/});await groupToggle.click();check(await groupToggle.getAttribute("aria-expanded")==="false","test group collapsed");
 await page.evaluate(()=>{window.__stableGroup=document.querySelector(".shortcut-group");window.__pageMarker=123;});
 let reloads=0;page.on("framenavigated",f=>{if(f===page.mainFrame())reloads++;});
 const second=await call("/api/team-websites","POST",{...first,name:"ZQA latest shortcut",description:"其他用户刚添加的入口",url:"https://example.com/new-local"},201);websites.push(second.id);
 check(await directory.getByRole("link",{name:"ZQA latest shortcut",exact:true}).count()===0,"new server entry not already in the mounted directory");
 const synced=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/website-layout"&&r.request().method()==="GET");
 await directory.getByRole("button",{name:"刷新网站目录",exact:true}).click();check((await synced).status()===200,"refresh fetches latest directory");
 await directory.getByRole("link",{name:"ZQA latest shortcut",exact:true}).waitFor();
 check(await groupToggle.getAttribute("aria-expanded")==="false","refresh preserves collapsed state");
 check(reloads===0&&await page.evaluate(()=>window.__pageMarker===123&&window.__stableGroup===document.querySelector(".shortcut-group")),"refresh never reloads page or remounts groups");
 // Create distinct peers so a pre-existing B->C edge cannot be mistaken for parallel branches.
 const base={type:"SKILL",summary:"本地多前置、多后续验证",version:"1",contact:"QA",businessDirection:"technical_operations",installationMode:"pending",documentationUrl:"https://example.com/manual",usageInstructions:"仅本地测试"};
 for(let i=0;i<4;i++){const result=await call("/api/resources","POST",{...base,name:"分支QA"+i,slug:"qa-"+randomUUID()},201);resources.push(result.id);}
 const links=resources.map((targetId,i)=>({direction:i<2?"before":"after",targetId,condition:i<2?"独立准备项":"可独立开展的后续分析"}));
 const hub=await call("/api/resources","POST",{...base,name:"多项关联中心QA",slug:"qa-"+randomUUID(),relationLinks:links},201);resources.push(hub.id);
 let data=await call("/api/resources"),edges=data.relations.filter(r=>r.sourceSkillId===hub.id||r.targetSkillId===hub.id);
 check(edges.filter(r=>r.targetSkillId===hub.id).length===2&&edges.filter(r=>r.sourceSkillId===hub.id).length===2,"two preceding and two following Skills persisted");
 check(!data.relations.some(r=>resources.slice(0,4).includes(r.sourceSkillId)&&resources.slice(0,4).includes(r.targetSkillId)),"sibling Skills have no invented serial dependency");
 await call("/api/resources/"+hub.id,"PUT",{relationLinks:links.map(r=>({...r,condition:r.condition+"（已确认）"}))});
 data=await call("/api/resources");check(data.relations.filter(r=>r.sourceSkillId===hub.id||r.targetSkillId===hub.id).length===4,"editing keeps all four associations");
 await page.reload();await page.locator(".workspace-shell:not([inert])").waitFor();await page.locator(".sidebar").getByRole("button",{name:"我创建的",exact:true}).click();await page.getByRole("heading",{name:"多项关联中心QA",exact:true}).click();
 await page.locator(".skill-relation-chain").waitFor();
 const stages=page.locator(".skill-relation-chain .relation-stage");
 check(await stages.nth(0).locator(".related-resource").count()===2&&await stages.nth(2).locator(".related-resource").count()===2,"both branches rendered in the correct stages");
 await page.getByRole("button",{name:"编辑资源",exact:true}).click();await page.locator(".resource-editor-form").waitFor();check(await page.locator(".relation-editor-row").count()===4,"resource editor loads every association");
 await page.getByRole("button",{name:"保存修改",exact:true}).click();await page.locator(".resource-editor-form").waitFor({state:"detached"});
 data=await call("/api/resources");check(data.relations.filter(r=>r.sourceSkillId===hub.id||r.targetSkillId===hub.id).length===4,"editor save does not truncate multiple links");
 await page.locator(".sidebar").getByRole("button",{name:"网站",exact:true}).click();await overview.getByRole("link",{name:first.name,exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"overview fits mobile width");await overview.screenshot({path:"outputs/browser-qa/website-shortcuts-v46-mobile.png"});
 check(errors.length===0,"no browser errors: "+errors.join(";"));console.log(JSON.stringify({websiteShortcutAndRelationChecks:checks}));
}finally{
 await browser.close();
 for(const id of resources){db.prepare("DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?").run(id,id);db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);}
 for(const id of resources)db.prepare("DELETE FROM resources WHERE id=?").run(id);
 for(const id of websites){db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);db.prepare("DELETE FROM team_websites WHERE id=?").run(id);}
 db.prepare("DELETE FROM sessions WHERE id=?").run(sid);db.close();
}
