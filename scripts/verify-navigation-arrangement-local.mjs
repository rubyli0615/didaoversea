// Local QA only: no production account or Key is used.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdirSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const origin="http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(name=>/^[a-f0-9]+\.sqlite$/.test(name)),dir));db.exec("PRAGMA busy_timeout=10000");
const browser=await chromium.launch({channel:"chrome",headless:true}),sessions=[],created=[],categories=[],errors=[];
const oldLayouts=db.prepare("SELECT * FROM website_layouts").all(),oldCategories=db.prepare("SELECT id,sort_order FROM website_categories").all();
let checks=0;const check=(ok,label)=>{assert(ok,label);checks++;};
async function login(userId) {
 const id=randomUUID(),token=randomBytes(32).toString("hex"),now=Math.floor(Date.now()/1000);sessions.push(id);
 db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(id,userId,createHash("sha256").update(token).digest("hex"),now+1800,now);
 const context=await browser.newContext({viewport:{width:1440,height:950}});
 await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);return context;
}
async function call(context,path,method="GET",data,status=200) {
 const response=await context.request.fetch(origin+path,{method,...(data?{data}:{})}),body=await response.json();
 check(response.status()===status,method+" "+path+" "+response.status()+" "+JSON.stringify(body));return body;
}
try {
 const creator=await login("usr-lumino"),viewer=await login("usr-william");
 const initial=await call(creator,"/api/resources");
 const etagResponse=await creator.request.get(origin+"/api/resources?summary=1");const etag=etagResponse.headers().etag;
 const weak=await creator.request.get(origin+"/api/resources?summary=1",{headers:{"If-None-Match":"W/"+etag}});check(weak.status()===304&&!(await weak.body()).length,"weak compressed ETag returns bodyless 304");
 const multi=await creator.request.get(origin+"/api/resources?summary=1",{headers:{"If-None-Match":JSON.stringify("old")+", W/"+etag}});check(multi.status()===304,"multiple ETag candidates supported");
 check(initial.resources.find(item=>item.id==="skill-hotel-audit").name==="Dida酒店静态skill","renamed hotel Skill");
 check(initial.resources.find(item=>item.id==="skill-hotel-audit").summary==="酒店静态信息查询与处理 Skill","hotel summary");
 check(initial.resources.find(item=>item.id==="skill-hotel-audit").scenario==="酒店静态数据查询","hotel scenario");
 for(const [slug,first,last] of [
 ["attribution-analysis","KsfGwpNddiT6EakG2f4codBYntc","CMRSwACU7iO1gEkvHiwcpTASnNf"],
 ["supplier-analysis","IV8owZS9Gi3vkEk4xznchnxqnRh","BEZwwlleoimPOBkZHVmcbcQwnyh"],
 ["l2l-downgrade","CRRGwHkqUiE7tdkUKT5caUbAnVf","F2qIwY6R7ijBpckpCtscIwzcnba"]
 ]){const resource=initial.resources.find(item=>item.slug===slug);check(resource.documentationUrl.includes(first)&&resource.referenceUrl.includes(last),"both requested documents "+slug);}
 for(let i=0;i<2;i++){const category=await call(creator,"/api/website-categories","POST",{scenario:"ai_tools",name:"排序测试"+i+"-"+randomUUID().slice(0,8)},201);categories.push(category.id);}
 for(let i=0;i<3;i++){
  const body=await call(creator,"/api/resources","POST",{type:"INTERNAL",name:"排序QA"+i,summary:"拖动排序和跨分类移动测试",slug:"test-"+randomUUID(),scenario:"ai_tools",websiteCategoryId:categories[0],sourceUrl:"https://example.com/"+randomUUID()},201);created.push({id:body.id,table:"resources"});
 }
 const page=await creator.newPage();let popups=0;page.on("popup",()=>popups++);await creator.route("https://example.com/**",route=>route.fulfill({status:200,contentType:"text/html",body:"<p>Local QA website</p>"}));page.on("pageerror",error=>errors.push(error.message));let directoryRequests=0;
 page.on("request",request=>{if(new URL(request.url()).pathname==="/api/website-layout"&&request.method()==="GET")directoryRequests++;});
 await page.goto(origin);await page.locator(".workspace-shell:not([inert])").waitFor();
 const nav=name=>page.locator(".sidebar").getByRole("button",{name,exact:true}).click();
 await nav("Data MCP");await page.locator(".mcp-data-section table").waitFor();
 check((await page.locator(".mcp-data-section tbody").textContent()).includes("data_ovs.weekly_bookable_hotel"),"Bookable metadata visible");
 await page.evaluate(()=>window.scrollTo(0,900));await page.waitForTimeout(250);await page.reload();
 await page.locator(".mcp-data-section table").waitFor();await page.waitForFunction(()=>scrollY===900);
 check(await page.locator(".workspace-tab.active").textContent().then(text=>text.includes("data-mcp")),"F5 restores active detail tab");
 check(await page.locator(".workspace-tab").count()===2,"F5 restores open tabs");
 await nav("海外渠道资源");await page.getByRole("heading",{name:"海外渠道资源",exact:true}).waitFor();await page.reload();await page.getByRole("heading",{name:"海外渠道资源",exact:true}).waitFor();check(true,"F5 restores parent module");
 await nav("Skills");await page.getByRole("heading",{name:"Dida酒店静态skill",exact:true}).click();await page.getByText("酒店静态数据查询",{exact:true}).waitFor();check(true,"hotel usage scenario visible in detail");await page.getByRole("button",{name:"编辑资源",exact:true}).click();check(await page.locator("input[name=scenario]").inputValue()==="酒店静态数据查询","usage scenario editable");await page.getByRole("button",{name:"取消",exact:true}).click();
 await nav("Skills");await page.getByRole("heading",{name:"产量异动归因 Skill",exact:true}).click();await page.locator(".table-approval").waitFor();
 check((await page.locator(".table-approval").textContent()).includes("数据权限&导出申请"),"Feishu approval instructions");
 check((await page.locator(".table-application-reason").textContent()).includes("产量异动归因 Skill"),"tailored reason below required tables");
 check(await page.getByRole("link",{name:"查看补充文档",exact:true}).count()===1,"second usage doc accessible");
 await nav("AI常用网站");await page.locator(".website-category-group").first().waitFor();
 await page.getByRole("textbox",{name:"搜索常用网站",exact:true}).fill("排序QA");
 const first=page.locator('[data-website-id="'+created[0].id+'"]'),last=page.locator('[data-website-id="'+created[2].id+'"]');
 let saved=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/website-layout"&&response.request().method()==="PUT");
 await last.locator(".website-resource-card").dragTo(first.locator(".website-resource-card"),{targetPosition:{x:8,y:60}});check((await saved).status()===200,"native drag saved");
 await page.getByText("移动已保存",{exact:true}).waitFor();
 const currentIds=()=>page.locator(".website-directory-item").evaluateAll((nodes,ids)=>nodes.map(node=>node.dataset.websiteId).filter(id=>ids.includes(id)),created.slice(0,3).map(row=>row.id));
  check(JSON.stringify(await currentIds())===JSON.stringify([created[2].id,created[0].id,created[1].id]),"native drag order visible");
 // Move to another category via the keyboard/touch alternative.
 const emptyName=db.prepare("SELECT name FROM website_categories WHERE id=?").get(categories[1]).name;
 saved=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/website-layout"&&response.request().method()==="PUT");await first.locator(".website-resource-card").dragTo(page.locator("header").filter({has:page.getByRole("heading",{name:emptyName,exact:true})}));check((await saved).status()===200,"cross-category move saved");await page.getByText("移动已保存",{exact:true}).waitFor();
 check(db.prepare("SELECT website_category_id FROM resources WHERE id=?").get(created[0].id).website_category_id===categories[1],"membership persisted");check(popups===0,"dragging a link card never opens a website");
 await page.getByRole("textbox",{name:"搜索常用网站",exact:true}).fill("");
 const target=page.locator(".website-category-group").filter({has:page.getByRole("heading",{name:db.prepare("SELECT name FROM website_categories WHERE id=?").get(categories[0]).name,exact:true})});
 const sourceName=db.prepare("SELECT name FROM website_categories WHERE id=?").get(categories[1]).name;
 saved=page.waitForResponse(response=>response.url().endsWith("/api/website-categories/reorder")&&response.request().method()==="PUT");
 await page.getByRole("button",{name:"分组排序",exact:true}).click();check(await page.locator(".website-resource-card").count()===0,"group sorting shows compact rows only");await page.locator(".common-websites-page").screenshot({path:"outputs/browser-qa/group-sort-v42.png"});
 await page.locator("header").filter({has:page.getByRole("heading",{name:sourceName,exact:true})}).dragTo(target.locator("header"));check((await saved).status()===200,"direct group drag saved");await page.getByText("移动已保存",{exact:true}).waitFor();await page.getByRole("button",{name:"完成排序",exact:true}).click();
 await page.getByRole("button",{name:"管理分类",exact:true}).click();const manager=page.locator(".category-manager");
 check(await manager.getByRole("combobox",{name:"分类顺序 "+sourceName,exact:true}).count()===1,"one-step priority selection");
 const reorder=page.waitForResponse(response=>response.url().endsWith("/api/website-categories/reorder")&&response.request().method()==="PUT");
 await manager.getByRole("combobox",{name:"分类顺序 "+sourceName,exact:true}).selectOption("0");check((await reorder).status()===200,"jump directly to first priority");
 await manager.getByText("分类顺序已保存",{exact:true}).waitFor();await manager.getByRole("button",{name:"完成",exact:true}).click();
 const requestsBefore=directoryRequests;
 await nav("海外OP常用网站");await page.locator(".website-category-toggle").first().waitFor();await nav("AI常用网站");await page.locator(".website-category-toggle").first().waitFor();
 check(directoryRequests===requestsBefore,"switching directories reuses combined cached response");
 await page.reload();await page.locator(".website-category-toggle").first().waitFor();
 check(await page.locator(".workspace-tab.active").textContent().then(text=>text.includes("AI常用网站")),"F5 restores website directory");
 check(await page.locator(".website-category-group").first().locator("h2").textContent()===sourceName,"group priority survives reload");
 const layout=(await call(creator,"/api/website-layout")).layouts.find(item=>item.scenario==="ai_tools");
 await call(viewer,"/api/website-layout","PUT",{scenario:"ai_tools",revision:layout.revision,siteId:created[1].id,groupId:categories[0],beforeId:null},403);
 await call(creator,"/api/website-layout","PUT",{scenario:"ai_tools",revision:layout.revision-1,siteId:created[1].id,groupId:categories[0],beforeId:null},409);
 await call(creator,"/api/website-layout","PUT",{scenario:"ai_tools",revision:layout.revision,siteId:created[1].id,groupId:"op-data",beforeId:null},409);
 const raceLayout=(await call(creator,"/api/website-layout")).layouts.find(item=>item.scenario==="ai_tools");
 const race=await Promise.all(categories.map(groupId=>creator.request.put(origin+"/api/website-layout",{data:{scenario:"ai_tools",revision:raceLayout.revision,siteId:created[1].id,groupId,beforeId:null}})));
 check(race.filter(response=>response.status()===200).length===1&&race.filter(response=>response.status()===409).length===1,"simultaneous moves have exactly one winner");
 check(db.prepare("SELECT website_category_id FROM resources WHERE id=?").get(created[1].id).website_category_id===categories[race.findIndex(response=>response.status()===200)],"losing move cannot overwrite membership");
 for(const teamId of ["ai-project","apac-me"]){const result=await call(creator,"/api/team-websites","POST",{teamId,name:"小组排序QA",description:"仅限本地测试",url:"https://example.com/"+randomUUID()},201);created.push({id:result.id,table:"team_websites"});}
 await nav("其他有用网站");await page.locator(".shortcut-group").first().waitFor();const refreshDirectory=page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="GET");await page.getByRole("button",{name:"刷新网站目录",exact:true}).click();await refreshDirectory;
 const teamSite=page.locator('[data-website-id="'+created[3].id+'"]');
 saved=page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="PUT");await teamSite.locator("a").dragTo(page.locator("header").filter({has:page.getByRole("heading",{name:"亚太中东运营组",exact:true})}));check((await saved).status()===200,"Creator can move team website");await page.getByText("移动已保存",{exact:true}).waitFor();
 check(db.prepare("SELECT team_id FROM team_websites WHERE id=?").get(created[3].id).team_id==="apac-me","team move persisted");
 const teamLayout=(await call(creator,"/api/website-layout")).layouts.find(item=>item.scenario==="teams");
 await call(viewer,"/api/website-layout","PUT",{scenario:"teams",revision:teamLayout.revision,siteId:created[3].id,groupId:"ai-project",beforeId:null},403);
 await call(viewer,"/api/website-layout","PUT",{scenario:"teams",revision:teamLayout.revision,siteId:created[3].id,groupId:"apac-me",beforeId:created[4].id});
 const groups=["ai-project","data","onboarding","apac-me","europe-americas","agoda"];
 const teamRefresh=page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="GET");await page.getByRole("button",{name:"刷新网站目录",exact:true}).click();await teamRefresh;
 await page.getByRole("button",{name:"分组排序",exact:true}).click();check(await page.locator(".website-shortcut").count()===0,"team group mode is compact");
 const firstTeamName=await page.locator(".shortcut-group h2").first().textContent();
 const [teamMove]=await Promise.all([page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="PUT"),page.getByRole("button",{name:"下移分组 "+firstTeamName,exact:true}).click()]);check(teamMove.status()===200,"one-click team group priority");await page.getByText("移动已保存",{exact:true}).waitFor();await page.getByRole("button",{name:"完成排序",exact:true}).click();
 const latest=(await call(creator,"/api/website-layout")).layouts.find(item=>item.scenario==="teams");
 await call(viewer,"/api/website-layout","PUT",{scenario:"teams",revision:latest.revision,groupIds:groups.reverse()},403);
 await call(creator,"/api/website-layout","PUT",{scenario:"teams",revision:latest.revision,groupIds:groups});
 // OP directory uses the same direct-card drag and keyboard ordering.
 const opIds=[];
 for(let i=0;i<2;i++){const result=await call(creator,"/api/resources","POST",{type:"INTERNAL",name:"OP排序QA"+i,summary:"直接拖动卡片验证",slug:"test-"+randomUUID(),scenario:"overseas_op",websiteCategoryId:"op-data",sourceUrl:"https://example.com/"+randomUUID()},201);opIds.push(result.id);created.push({id:result.id,table:"resources"});}
 const catalogRefresh=page.waitForResponse(response=>response.url().includes("/api/resources?refresh=1"));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await catalogRefresh;await nav("海外OP常用网站");
 const opA=page.locator('[data-website-id="'+opIds[0]+'"]'),opB=page.locator('[data-website-id="'+opIds[1]+'"]');await opA.waitFor();
 const opMove=page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="PUT");await opB.locator(".website-resource-card").dragTo(opA.locator(".website-resource-card"),{targetPosition:{x:8,y:60}});check((await opMove).status()===200,"OP card body directly draggable");await page.getByText("移动已保存",{exact:true}).waitFor();
 const opWidth=(await opA.locator(".website-resource-card").boundingBox()).width;
 const opForward=page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="PUT");await opB.locator(".website-resource-card").dragTo(opA.locator(".website-resource-card"),{targetPosition:{x:opWidth-8,y:60}});check((await opForward).status()===200,"dragging forward lands after target");await page.getByText("移动已保存",{exact:true}).waitFor();
 check(JSON.stringify(await page.locator(".website-directory-item").evaluateAll((nodes,ids)=>nodes.map(node=>node.dataset.websiteId).filter(id=>ids.includes(id)),opIds))===JSON.stringify(opIds),"same-group forward drag reaches the final card position");
 await opA.focus();const keyMove=page.waitForResponse(response=>response.url().endsWith("/api/website-layout")&&response.request().method()==="PUT");await page.keyboard.press("Alt+ArrowRight");check((await keyMove).status()===200,"keyboard card ordering remains available");await page.getByText("移动已保存",{exact:true}).waitFor();
 const popup=page.waitForEvent("popup");await opA.locator(".website-resource-card").click();const opened=await popup;check(opened.url().startsWith("https://example.com/"),"single click still opens website");await opened.close();
 // Tampered or cross-user saved navigation cannot bypass resource or admin permissions.
 const otherPage=await viewer.newPage();await otherPage.addInitScript(()=>sessionStorage.setItem("dida-workspace:usr-william",JSON.stringify({tabs:[{id:"admin"},{id:"resource:missing"},{id:"website-ai"}],activeId:"admin"})));await otherPage.goto(origin);await otherPage.locator(".common-websites-page").waitFor();
 check(await otherPage.locator(".workspace-tab").count()===1&&!await otherPage.getByRole("button",{name:"添加网站",exact:true}).count(),"saved navigation revalidated against current role and catalog");
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mobile directory fits");
 await nav("AI常用网站");await page.locator(".website-resource-card").first().waitFor();check(await page.locator(".website-directory-item").evaluateAll(items=>items.every(item=>{const card=item.querySelector(".website-resource-card").getBoundingClientRect(),actions=item.querySelector(".website-directory-actions").getBoundingClientRect();return actions.top>=card.bottom;})),"compact card actions never overlap the card");await page.screenshot({path:"outputs/browser-qa/directory-arrangement-v41-mobile-cards.png",fullPage:true});await page.getByRole("button",{name:"管理分类",exact:true}).click();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mobile category manager fits");
 mkdirSync("outputs/browser-qa",{recursive:true});await page.screenshot({path:"outputs/browser-qa/directory-arrangement-v41-mobile.png",fullPage:true});
 check(errors.length===0,"no browser errors: "+errors.join(";"));console.log(JSON.stringify({navigationArrangementChecks:checks,directoryRequests}));
} finally {
 await browser.close();
 for(const row of created){if(row.table==="resources"){db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(row.id);db.prepare("DELETE FROM resources WHERE id=?").run(row.id);}else db.prepare("DELETE FROM team_websites WHERE id=?").run(row.id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(row.id);}
 for(const id of categories){db.prepare("DELETE FROM website_categories WHERE id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);}
 for(const row of oldCategories)db.prepare("UPDATE website_categories SET sort_order=? WHERE id=?").run(row.sort_order,row.id);
 db.prepare("DELETE FROM website_layouts").run();for(const row of oldLayouts)db.prepare("INSERT INTO website_layouts (scenario,site_ids,group_ids,revision,updated_at,operation_id) VALUES (?,?,?,?,?,?)").run(row.scenario,row.site_ids,row.group_ids,row.revision,row.updated_at,row.operation_id);
 for(const id of sessions)db.prepare("DELETE FROM sessions WHERE id=?").run(id);db.close();
}
