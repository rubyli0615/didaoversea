// Local, temporary fixtures only. Does not read or submit any production credential.
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {readdirSync,mkdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {chromium} from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import {importSource} from "./ts-module-loader.mjs";
const {resourceUsage}=await importSource("../lib/resource-usage.ts",import.meta.url);
const origin="http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url),db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec("PRAGMA busy_timeout=10000");
const sid=randomUUID(),token=randomBytes(32).toString("hex"),now=Math.floor(Date.now()/1000),fixtures=[];
db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(sid,"usr-lumino",createHash("sha256").update(token).digest("hex"),now+1800,now);
const browser=await chromium.launch({channel:"chrome",headless:true});let checks=0;const check=(ok,label)=>{assert(ok,label);checks++;};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);
 const api=async(path,method="GET",data,status=200)=>{const response=await context.request.fetch(origin+path,{method,...(data?{data}:{})}),body=await response.json();check(response.status()===status,JSON.stringify(body));if(status===201)fixtures.push(body.id);return body;};
 const base={type:"SKILL",slug:"test-"+randomUUID(),name:"填表展示测试",summary:"只在本地验证表单",version:"2.0",contact:"维护人甲",businessDirection:"technical_operations",installationMode:"pending",installationCommand:"1. 先阅读使用文档。\n2. 下载附件后完成准备。",usageExample:"",usageInstructions:"先确认授权范围，再在本地客户端发起对话。",documentationUrl:"https://example.com/manual"};
 await api("/api/resources","POST",{...base,documentationUrl:""},400);
 await api("/api/resources","POST",{...base,usageExample:"提供 ClientID 和日期，填写参数后点击开始。"},400);
 const absent=await api("/api/resources","POST",base,201);
 const view=(await api("/api/resources/"+absent.id+"/detail")).resource;
 check(view.usageExample===null&&view.usageInstructions===base.usageInstructions,"optional example and separate guidance round trip");
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>window.__copied=text}}));
 await page.goto(origin);await page.locator(".workspace-shell:not([inert])").waitFor();const nav=name=>page.locator(".sidebar").getByRole("button",{name,exact:true}).click();
 await nav("Skills");await page.getByRole("button",{name:"创建资源",exact:true}).click();await page.locator(".resource-editor-form").waitFor();
 for(const field of ["name","summary","contact","version","usageInstructions","usageExample","documentationUrl","caseUrl","referenceUrl"]){
  const input=page.locator('[name="'+field+'"]');check(await input.inputValue()==="","new "+field+" is genuinely empty");check(Boolean(await input.getAttribute("placeholder")),"new "+field+" has implicit guidance");
 }
 check(await page.locator('[name="businessDirection"]').inputValue()==="","category requires explicit choice");
 check(await page.locator('[name="usageExample"]').getAttribute("required")===null,"usage example is optional");
 check(await page.locator('[name="documentationUrl"]').getAttribute("required")!==null,"usage document required");
 const positions=await page.locator(".document-link-fields input").evaluateAll(nodes=>nodes.map(n=>({name:n.name,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width})));
 check(positions.map(p=>p.name).join(",")==="documentationUrl,caseUrl,referenceUrl","correct document order");
 check(positions.every(p=>p.x===positions[0].x&&p.width===positions[0].width)&&positions[0].y<positions[1].y&&positions[1].y<positions[2].y,"one document link per full-width row");
 check(await page.getByLabel("安装方式",{exact:true}).getByRole("option",{name:"其他",exact:true}).getAttribute("value")==="pending","Other keeps compatible stored mode");
 await page.getByRole("button",{name:"添加一项",exact:true}).click();check(await page.getByLabel("第 1 项优先级",{exact:true}).inputValue()==="","permission priority is a placeholder, not a prefill");
 await page.getByRole("button",{name:"取消",exact:true}).click();
 await nav("我创建的");await page.getByRole("heading",{name:base.name,exact:true}).click();await page.locator(".resource-page").waitFor();
 check(await page.locator(".installation-guide").textContent()===base.installationCommand,"Other installation explanation shown verbatim as normal text");
 check(await page.getByRole("button",{name:"复制安装指令",exact:true}).count()===0,"Other mode has no installation command copy box");
 check(await page.getByRole("button",{name:"复制使用指令",exact:true}).count()===0,"missing usage example creates no copy box");
 check((await page.locator(".usage-guidance").textContent()).includes(base.usageInstructions),"guidance remains plain text");
 await page.getByRole("button",{name:"编辑资源",exact:true}).click();
 check(await page.locator('[name="contact"]').inputValue()==="维护人甲"&&await page.locator('[name="version"]').inputValue()==="2.0","editing preserves real saved values");
 check(await page.locator('[name="usageInstructions"]').inputValue()===base.usageInstructions,"edit guidance not discarded");
 const command="使用 test-skill，查询【渠道】在【日期】的订单变化。";
 await page.locator('[name="usageExample"]').fill(command);
 const [saved]=await Promise.all([page.waitForResponse(r=>r.url().endsWith("/api/resources/"+absent.id)&&r.request().method()==="PUT"),page.getByRole("button",{name:"保存修改",exact:true}).click()]);check(saved.status()===200,"guidance and example save together");await page.locator(".resource-editor-form").waitFor({state:"detached"});await page.getByRole("heading",{name:base.name,exact:true}).click();await page.getByRole("button",{name:"复制使用指令",exact:true}).click();check(await page.evaluate(()=>window.__copied)===command,"copy contains only ready-to-send agent command");
 await page.mouse.move(1300,80);await page.waitForTimeout(250);
 const colors=await page.evaluate(()=>[".copy-usage",".resource-side .side-edit"].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [s.color,s.backgroundColor,s.borderColor];}));check(JSON.stringify(colors[0])===JSON.stringify(colors[1]),"copy and edit share text, fill and border colors");
 const catalog=await api("/api/resources");
 for(const resource of catalog.resources.filter(r=>r.type==="SKILL"&&r.id!==absent.id&&r.usageExample)){
  await nav("Skills");await page.getByRole("heading",{name:resource.name,exact:true}).click();await page.locator(".resource-page").waitFor();
  const usage=resourceUsage(resource);
  if(resource.slug==="attribution-analysis"){
   check(await page.getByLabel("渠道 / ClientID",{exact:true}).inputValue()===""&&await page.getByLabel("分析日期",{exact:true}).inputValue()==="","online ID and date start empty");
   check(await page.getByLabel("当前期窗口",{exact:true}).inputValue()===""&&await page.locator(".analysis-metrics input:checked").count()===0,"online window and metrics are not preselected");
  }else if(usage.command){await page.getByRole("button",{name:"复制使用指令",exact:true}).click();check(await page.evaluate(()=>window.__copied)===usage.command,"audited command only "+resource.slug);}
  else check(await page.getByRole("button",{name:"复制使用指令",exact:true}).count()===0,"prose-only resource has no misleading command "+resource.slug);
  if(usage.instructions)check((await page.locator(".usage-guidance").textContent()).includes(usage.instructions),"legacy prose retained "+resource.slug);
  check(await page.locator(".application-reason-code pre").count()===0,"application reason isn't executable code");
 }
 for(const name of ["Tiger MCP","Data MCP"]){
  await nav(name);await page.locator(".mcp-connection-section").waitFor();
  const connection=page.locator(".mcp-connection-section");
  check((await connection.locator(">p").textContent()).includes("替换为本人真实鉴权 Key"),"replacement instructions in editable access description");
  check(await connection.locator(".mcp-key-hint").count()===0,"duplicate lower warning removed");
  const original=catalog.resources.find(r=>r.slug===(name==="Tiger MCP"?"tiger-mcp":"data-mcp")).installationCommand;
  await connection.getByRole("button",{name:"复制安装指令",exact:true}).click();check(await page.evaluate(()=>window.__copied)===original,"MCP installation unchanged");
 }
 await nav("Skills");await page.getByRole("button",{name:"创建资源",exact:true}).click();await page.getByLabel("资源类型",{exact:true}).selectOption("AGENT");check(await page.locator('[name="usageInstructions"]').inputValue()===""&&await page.locator('[name="version"]').inputValue()==="","Agent defaults converted to placeholders");
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mobile form fits");
 mkdirSync("outputs/browser-qa",{recursive:true});await page.screenshot({path:"outputs/browser-qa/authoring-guidance-v45-mobile.png",fullPage:true});
 check(errors.length===0,"no runtime errors "+errors.join(";"));console.log(JSON.stringify({authoringGuidanceChecks:checks}));
}finally{await browser.close();for(const id of fixtures){db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);db.prepare("DELETE FROM resources WHERE id=?").run(id);}db.prepare("DELETE FROM sessions WHERE id=?").run(sid);db.close();}
