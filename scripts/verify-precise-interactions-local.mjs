// Local fixtures and synthetic sessions only; does not contact production or copy real Keys.
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {readdirSync,mkdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {chromium} from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const origin="http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec("PRAGMA busy_timeout=10000");
const sid=randomUUID(),token=randomBytes(32).toString("hex"),now=Math.floor(Date.now()/1000),created=[],categories=[];
const layouts=db.prepare("SELECT * FROM website_layouts").all(),oldCategories=db.prepare("SELECT id,sort_order FROM website_categories").all();
db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(sid,"usr-ruby",createHash("sha256").update(token).digest("hex"),now+1800,now);
const browser=await chromium.launch({channel:"chrome",headless:true});let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);
 const api=async(path,method="GET",data,status=200)=>{const r=await context.request.fetch(origin+path,{method,...(data?{data}:{})}),body=await r.json();check(r.status()===status,JSON.stringify(body));return body;};
 for(let i=0;i<3;i++){const c=await api("/api/website-categories","POST",{scenario:"ai_tools",name:"精确落点"+i+"-"+randomUUID().slice(0,6)},201);categories.push(c.id);}
 for(let i=0;i<3;i++){const r=await api("/api/resources","POST",{type:"INTERNAL",slug:"test-"+randomUUID(),name:"精确卡片"+i,summary:"仅本地拖动验证",scenario:"ai_tools",websiteCategoryId:categories[0],sourceUrl:"https://example.com/"+randomUUID()},201);created.push(r.id);}
 const reason="只读查询指定测试表，用于核验业务指标；不修改源数据。";
 const skill=await api("/api/resources","POST",{type:"SKILL",slug:"test-"+randomUUID(),name:"申请原因验证",summary:"仅本地",version:"1.0",installationMode:"none",businessDirection:"technical_operations",contact:"测试",documentationUrl:"https://example.com/docs",usageExample:"测试",dataPermissions:[{priority:"P0",table:"public.test",purpose:"示例表"}],tablePermissionReason:reason},201);created.push(skill.id);
 check((await api("/api/resources/"+skill.id+"/detail")).resource.tablePermissionReason===reason,"custom reason saved");
 const summary=await api("/api/resources?summary=1");check(!Object.hasOwn(summary.resources.find(r=>r.id===skill.id),"tablePermissionReason"),"summary omits long reason");
 await api("/api/resources/"+skill.id,"PUT",{tablePermissionReason:"x".repeat(4001)},400);
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin);await page.locator(".workspace-shell:not([inert])").waitFor();
 const nav=name=>page.locator(".sidebar").getByRole("button",{name,exact:true}).click();
 await nav("Tiger MCP");await page.locator(".mcp-connection-section").waitFor();
 check((await page.locator(".page-breadcrumb").innerText()).replace(/\s/g,"")==="DIDAAI资源TigerMCP","DIDA breadcrumb skips redundant MCP level");
 check(await page.locator(".installation-code input.inline-script-key").count()===0,"installation script no longer contains a Key input");
 await nav("Skills");await page.getByRole("heading",{name:"Dida酒店静态skill",exact:true}).click();await page.locator(".resource-page").waitFor();
 check(await page.locator(".table-approval").count()===0,"API-only Skill has no table approval");
 check((await page.locator(".page-breadcrumb").innerText()).replace(/\s/g,"")==="海外渠道资源SkillsDida酒店静态skill","Skill hierarchy breadcrumb");
 await nav("Skills");await page.getByRole("heading",{name:"申请原因验证",exact:true}).click();await page.locator(".table-application-reason").waitFor();
 check((await page.locator(".table-application-reason").textContent()).includes(reason),"custom reason displayed");
 check(await page.locator(".table-approval").count()===1,"table Skill has one approval guide");
 await page.getByRole("button",{name:"编辑资源",exact:true}).click();await page.locator("textarea[name=tablePermissionReason]").waitFor();
 await page.locator("textarea[name=tablePermissionReason]").fill(reason+"更新");
 const [savedReason]=await Promise.all([page.waitForResponse(r=>r.url().endsWith("/api/resources/"+skill.id)&&r.request().method()==="PUT"),page.getByRole("button",{name:"保存修改",exact:true}).click()]);
 check(savedReason.status()===200,"reason editable through form");await page.locator(".resource-editor-form").waitFor({state:"detached"});
 check((await api("/api/resources/"+skill.id+"/detail")).resource.tablePermissionReason===reason+"更新","form persists custom reason");
 await nav("AI常用网站");await page.locator(".website-category-group").first().waitFor();
 const cards=created.slice(0,3),card=id=>page.locator('[data-website-id="'+id+'"]');
 let release,putStarted;
 const started=new Promise(resolve=>putStarted=resolve),gate=new Promise(resolve=>release=resolve);
 await page.route("**/api/website-layout",async route=>{if(route.request().method()==="PUT"){putStarted();await gate;}await route.continue();});
 const b=await card(cards[2]).boundingBox(),a=await card(cards[0]).boundingBox();
 await page.mouse.move(b.x+30,b.y+45);await page.mouse.down();await page.mouse.move(b.x+45,b.y+45,{steps:3});await page.mouse.move(a.x+8,a.y+45,{steps:12});await page.mouse.move(a.x+9,a.y+45);
 await card(cards[0]).filter({has:page.locator("a")}).waitFor();
 check(await card(cards[0]).evaluate(n=>n.classList.contains("drop-before")),"card insertion line before target while holding");
 check(await card(cards[0]).evaluate(n=>getComputedStyle(n,"::before").backgroundColor)==="rgb(48, 77, 202)","insertion line visibly blue");
 mkdirSync("outputs/browser-qa",{recursive:true});await page.screenshot({path:"outputs/browser-qa/precise-card-gap-v43.png"});
 await page.mouse.up();await started;
 check((await page.locator(".website-directory-item").evaluateAll((nodes,ids)=>nodes.map(n=>n.dataset.websiteId).filter(id=>ids.includes(id)),cards))[0]===cards[2],"position changes before server response");
 check(await page.getByText("正在保存移动…",{exact:true}).isVisible(),"pending save shown without blocking visible reorder");
 release();await page.getByText("移动已保存",{exact:true}).waitFor();await page.unroute("**/api/website-layout");
 await page.getByRole("button",{name:"分组排序",exact:true}).click();
 const categoryName=id=>db.prepare("SELECT name FROM website_categories WHERE id=?").get(id).name;
 const group=id=>page.locator(".website-category-group").filter({has:page.getByRole("heading",{name:categoryName(id),exact:true})});
 await group(categories[0]).scrollIntoViewIfNeeded();const source=await group(categories[0]).locator("button.website-category-toggle").boundingBox(),target=await group(categories[1]).boundingBox();
 await page.mouse.move(source.x+90,source.y+15);await page.mouse.down();await page.mouse.move(source.x+100,source.y+15,{steps:3});await page.mouse.move(target.x+100,target.y+target.height-3,{steps:12});await page.mouse.move(target.x+101,target.y+target.height-3);
 check(await group(categories[1]).evaluate(n=>n.classList.contains("drop-after")),"group line marks gap below second and above third");
 check(await page.locator(".website-category-group").evaluateAll(nodes=>nodes.reduce((n,node)=>n+["::before","::after"].filter(p=>{const s=getComputedStyle(node,p);return s.content!=="none"&&s.content!=="normal"&&s.height==="3px";}).length,0))===1,"exactly one insertion marker across all groups");
 await page.screenshot({path:"outputs/browser-qa/precise-group-gap-v43.png"});
 const [groupSaved]=await Promise.all([page.waitForResponse(r=>r.url().endsWith("/api/website-categories/reorder")&&r.request().method()==="PUT"),page.mouse.up()]);
 check(groupSaved.status()===200,"dragging group from its title button works");await page.getByText("移动已保存",{exact:true}).waitFor();
 const order=await page.locator(".website-category-group h2").allTextContents();
 check(order.indexOf(categoryName(categories[1]))+1===order.indexOf(categoryName(categories[0]))&&order.indexOf(categoryName(categories[0]))+1===order.indexOf(categoryName(categories[2])),"group inserted in indicated gap");
 await page.getByRole("button",{name:"完成排序",exact:true}).click();
 // Simulated rejected save must restore the previous visible order.
 const before=await page.locator(".website-directory-item").evaluateAll(ns=>ns.map(n=>n.dataset.websiteId));
 await page.route("**/api/website-layout",route=>route.request().method()==="PUT"?route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({error:"本地模拟并发冲突"})}):route.continue());
 await card(cards[1]).locator("a").dragTo(card(cards[2]).locator("a"),{targetPosition:{x:8,y:45}});
 await page.getByRole("alert").filter({hasText:"本地模拟并发冲突"}).waitFor();
 await page.getByText("正在保存移动…",{exact:true}).waitFor({state:"detached"});
 check(JSON.stringify(await page.locator(".website-directory-item").evaluateAll(ns=>ns.map(n=>n.dataset.websiteId)))===JSON.stringify(before),"failed save restores authoritative order");
 await page.unroute("**/api/website-layout");
 check(errors.length===0,"no runtime errors "+errors.join(";"));
 console.log(JSON.stringify({preciseInteractionChecks:checks}));
}finally{
 await browser.close();
 for(const id of created){db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(id);db.prepare("DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?").run(id,id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);db.prepare("DELETE FROM resources WHERE id=?").run(id);}
 for(const id of categories){db.prepare("DELETE FROM website_categories WHERE id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);}
 for(const row of oldCategories)db.prepare("UPDATE website_categories SET sort_order=? WHERE id=?").run(row.sort_order,row.id);
 db.prepare("DELETE FROM website_layouts").run();for(const r of layouts)db.prepare("INSERT INTO website_layouts (scenario,site_ids,group_ids,revision,updated_at,operation_id) VALUES (?,?,?,?,?,?)").run(r.scenario,r.site_ids,r.group_ids,r.revision,r.updated_at,r.operation_id);
 db.prepare("DELETE FROM sessions WHERE id=?").run(sid);db.close();
}
