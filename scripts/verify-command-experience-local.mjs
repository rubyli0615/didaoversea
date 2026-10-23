// Local-only UI QA. Fake keys are captured in memory; nothing is written to the system clipboard.
import assert from "node:assert/strict";
import { createHash,randomBytes,randomUUID } from "node:crypto";
import { readdirSync,mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { importSource } from "./ts-module-loader.mjs";
const {personalizeMcpCommand,mcpKeyHeader,hasMcpKeyField}=await importSource("../lib/mcp-installation.ts",import.meta.url);
const origin="http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(name=>/^[a-f0-9]+\.sqlite$/.test(name)),dir));db.exec("PRAGMA busy_timeout=10000");
const sid=randomUUID(),token=randomBytes(32).toString("hex"),now=Math.floor(Date.now()/1000);
db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(sid,"usr-ruby",createHash("sha256").update(token).digest("hex"),now+1800,now);
const browser=await chromium.launch({channel:"chrome",headless:true}),errors=[],requests=[];
let checks=0;const check=(value,label)=>{assert(value,label);checks++;};
try {
 const localTemplate='{"agent_user_key":"placeholder"}',special='line1'+String.fromCharCode(10)+'"quoted"\\tail$&';
 check(JSON.parse(personalizeMcpCommand(localTemplate,"agent_user_key",special)).agent_user_key===special,"JSON escapes multiline and quoted opaque values");
 check(!hasMcpKeyField('{"other":"placeholder"}',"agent_user_key"),"missing header detected instead of pretending a Key was inserted");
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);
 const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>requests.push({url:request.url(),body:request.postData()??""}));
 await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__copied=text;}}}));
 await page.goto(origin);await page.locator(".workspace-shell:not([inert])").waitFor();
 const initial=await (await context.request.get(origin+"/api/resources")).json();
 const nav=name=>page.locator(".sidebar").getByRole("button",{name,exact:true}).click();
 for(const resource of initial.resources.filter(item=>item.type==="SKILL")) {
  await nav("Skills");await page.getByRole("heading",{name:resource.name,exact:true}).click();await page.locator(".resource-page").waitFor();
  check(await page.locator(".resource-side").getByRole("button",{name:"复制安装指令",exact:true}).count()===0,"no sidebar install button "+resource.slug);
  check(await page.locator(".resource-side").getByRole("link",{name:"查看使用文档",exact:true}).count()===(resource.documentationUrl?1:0),"documents appear in right sidebar "+resource.slug);
  if(resource.installationCommand && resource.installationMode!=="pending") {
   const block=page.locator(".installation-instructions"),button=block.getByRole("button",{name:"复制安装指令",exact:true});
   await button.click();check(await page.evaluate(()=>window.__copied)===resource.installationCommand,"verbatim installation copy "+resource.slug);
   const buttonBox=await button.boundingBox(),pre=await block.locator("pre").boundingBox();
   check(buttonBox.y<pre.y&&buttonBox.x+buttonBox.width>pre.x+pre.width*.8,"install copy at upper right "+resource.slug);
  }
  const usage=page.locator(".resource-content-card").filter({has:page.getByRole("heading",{name:"如何使用",exact:true})});
  if(resource.documentationUrl) {
   const docs=page.locator(".resource-side").getByRole("link",{name:"查看使用文档",exact:true});
   check(await docs.getAttribute("href")===resource.documentationUrl,"Skill docs in sidebar "+resource.slug);
   check(await usage.getByRole("link",{name:"查看使用文档",exact:true}).count()===0,"no duplicate documents under instructions");

  }
  if(resource.dataPermissions.length){
   const fonts=await page.locator(".prerequisites").evaluate(node=>({table:getComputedStyle(node.querySelector(".permission-disclosure>summary")).fontSize,reason:getComputedStyle(node.querySelector(".table-application-reason>h3")).fontSize}));
   check(fonts.table===fonts.reason,"reason and table heading have the same font size");
  }
 }
 await nav("展开或收起 Agent");
 for(const name of ["Dida API内部小助手","Sponge问答小助手"]){
  await nav(name);await page.locator(".resource-page").waitFor();const usage=page.locator(".resource-content-card").filter({has:page.getByRole("heading",{name:"如何使用",exact:true})});
  check(await page.locator(".resource-side").getByRole("link",{name:"查看使用文档",exact:true}).count()===1,"Agent docs in sidebar "+name);
  check(await page.locator(".resource-side .agent-reference").count()===1&&await page.getByRole("link",{name:"打开 Agent",exact:true}).count()===1,"Agent launch retained without duplicate docs");
 }
 for(const [name,slug] of [["Tiger MCP","tiger-mcp"],["Data MCP","data-mcp"]]){
  const resource=initial.resources.find(item=>item.slug===slug);
  await nav(name);await page.locator(".mcp-connection-section").waitFor();
  const connection=page.locator(".mcp-connection-section");
  check(await connection.locator("input").count()===0,"MCP has no personal Key input");
  await connection.getByRole("button",{name:"复制安装指令",exact:true}).click();
  check(await page.evaluate(()=>window.__copied)===resource.installationCommand,"copies exact unchanged installation template");
  check((await connection.locator("pre").textContent())===resource.installationCommand,"original template remains visible");
  check((await connection.textContent()).includes("替换为本人真实鉴权 Key"),"explains replacing Key in own client");
  check(await page.locator(".resource-side").getByRole("link",{name:"查看使用文档",exact:true}).count()===(resource.documentationUrl?1:0),"MCP document moved to sidebar");
 }
 await page.evaluate(()=>navigator.clipboard.writeText=async()=>{throw Error("blocked");});
 await page.getByRole("button",{name:"复制安装指令",exact:true}).click();
 check(await page.getByText("复制失败，请选中代码框内的指令手动复制。",{exact:true}).isVisible(),"failed copy offers manual copying");
 await nav("Skills");await nav("Data MCP");await page.locator(".mcp-connection-section").waitFor();
 mkdirSync("outputs/browser-qa",{recursive:true});await page.locator(".mcp-connection-section").screenshot({path:"outputs/browser-qa/mcp-connection-v42.png"});
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"MCP mobile layout fits");await page.screenshot({path:"outputs/browser-qa/mcp-connection-v42-mobile.png",fullPage:true});

 check(errors.length===0,"no browser errors "+errors.join(";"));
 console.log(JSON.stringify({commandExperienceChecks:checks}));
} finally {await browser.close();db.prepare("DELETE FROM sessions WHERE id=?").run(sid);db.close();}
