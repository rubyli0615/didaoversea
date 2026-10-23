// Local preview only: temporary session and website fixtures; no production credentials.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { importSource } from './ts-module-loader.mjs';
const { DATA_MCP_TABLES } = await importSource('../lib/mcp-inventory-content.ts', import.meta.url);
const { TIGER_MCP_TOOLS, DATA_MCP_TOOLS } = await importSource('../lib/mcp-content.ts', import.meta.url);
const origin='http://127.0.0.1:5173',dir=new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec('PRAGMA busy_timeout=10000');
const sessionId=randomUUID(),token=randomBytes(32).toString('hex'),now=Math.floor(Date.now()/1000),fixtures=[],errors=[];
db.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').run(sessionId,'usr-ruby',createHash('sha256').update(token).digest('hex'),now+1200,now);
const browser=await chromium.launch({channel:'chrome',headless:true});let checks=0;
const check=(ok,message)=>{assert(ok,message);checks++;};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'dida_ai_session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.locator('.resource-card').first().waitFor();
 const listing=await (await context.request.get(origin+'/api/resources')).json();
 const inventory=JSON.parse(readFileSync('D:/mcp-inventory/inventory.json','utf8'));
 check(JSON.stringify(DATA_MCP_TABLES.filter(t=>t.name!=="data_ovs.weekly_bookable_hotel").map(t=>t.name).sort())===JSON.stringify(inventory.tables.map(t=>t.name).sort()),'every provided inventory table retained exactly once');
 check(DATA_MCP_TABLES.every(t=>t.purpose.length>15)&&new Set(DATA_MCP_TABLES.map(t=>t.purpose)).size===37,'all tables have distinct substantive purposes');
 const names=new Set(DATA_MCP_TABLES.map(t=>t.name));
 for(const resource of listing.resources.filter(r=>r.type==='SKILL'))for(const row of resource.dataPermissions)check(names.has(row.table),'Skill prerequisite covered by directory: '+row.table);
 check(!listing.resources.some(r=>JSON.stringify(r.dataPermissions).includes('public.clientsloscallcount')),'LOS table typo corrected in persisted content');
 const nav=name=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
 for(const [name,tools,count] of [['Tiger MCP',TIGER_MCP_TOOLS,3],['Data MCP',DATA_MCP_TOOLS,37]]){
  await nav(name);await page.locator('.mcp-data-section').waitFor();
  check(JSON.stringify(await page.locator('.mcp-tools-section td:first-child code').allTextContents())===JSON.stringify(tools),name+' exact complete tool IDs');
  check(await page.locator('.mcp-data-section tbody tr').count()===count,name+' data row count');
  check(await page.locator('.mcp-tools-section th').count()===2&&await page.locator('.mcp-data-section th').count()===2,'status columns removed');
  for(const selector of ['.mcp-tools-section','.mcp-data-section']){
   const disclosure=page.locator(selector+' details');await disclosure.locator('summary').click();check(!(await disclosure.locator('table').isVisible()),'table collapses '+selector);await disclosure.locator('summary').click();check(await disclosure.locator('table').isVisible(),'table reopens '+selector);
  }
  await page.locator('.resource-page').screenshot({path:'outputs/browser-qa/'+(name==='Tiger MCP'?'tiger':'data')+'-directory-v38.png'});
 }
 for(const [label,type] of [['Skills','SKILL'],['MCP','MCP'],['Agent','AGENT']]){
  await nav(label);await page.getByRole('heading',{name:label,exact:true}).waitFor();
  check(await page.locator('.resource-card').count()===listing.resources.filter(r=>r.type===type).length,label+' opens all visible resources of type');
 }
 check(await page.locator('.sidebar').getByRole('button',{name:'展开或收起 Agent',exact:true}).getAttribute('aria-expanded')==='false','catalog click does not change disclosure');
 await nav('展开或收起 Agent');
 for(const [name,slug,detail] of [
  ['Dida API内部小助手','dida-api-assistant','适合快速入门所有 API 相关的知识或者针对专门的问题咨询小助手'],
  ['Sponge问答小助手','sponge-assistant','适合查询海外线上渠道私有知识库支持的问题'],
 ]){
  await nav(name);await page.locator('.resource-page').waitFor();await page.getByText(detail,{exact:true}).waitFor();
  const resource=listing.resources.find(r=>r.slug===slug);
  check(resource.detail===detail&&resource.usageExample==='进入对话界面开启对话即可。','exact persisted Agent content');
  check(await page.getByText('进入对话界面开启对话即可。',{exact:true}).isVisible(),'plain Agent usage visible');
  check(await page.locator('.resource-documents').getByRole('link',{name:'查看使用文档',exact:true}).getAttribute('href')===resource.referenceUrl,'renamed Agent documentation button');
 }
 const teamResponse=await context.request.post(origin+'/api/team-websites',{data:{teamId:'ai-project',name:'汇总测试-'+randomUUID(),description:'可见的小组网站',url:'https://example.com'}});check(teamResponse.status()===201,'team website fixture created');const team=await teamResponse.json();fixtures.push({id:team.id,table:'team_websites'});
 await nav('网站');await page.getByRole('heading',{name:'网站',exact:true}).waitFor();
 const teamListing=await (await context.request.get(origin+'/api/team-websites')).json();const teamName=teamListing.websites.find(w=>w.id===team.id).name;await page.getByRole('heading',{name:teamName,exact:true}).waitFor();
 const websiteCards=await page.locator('.website-resource-card').count();const expectedWebsites=listing.resources.filter(r=>r.type==='INTERNAL').length+teamListing.websites.length;check(websiteCards===expectedWebsites,'website type includes OP, AI and team websites: '+websiteCards+' / '+expectedWebsites+'; '+JSON.stringify(await page.locator('.website-resource-card h3').allTextContents()));
 const aiResponse=await context.request.post(origin+'/api/resources',{data:{type:'INTERNAL',scenario:'ai_tools',websiteCategoryId:'ai-chat',name:'折叠验证-'+randomUUID().slice(0,8),summary:'用于测试分类折叠',sourceUrl:'https://example.com',slug:'test-'+randomUUID(),installationMode:'none'}});check(aiResponse.status()===201,'AI website fixture');fixtures.push({id:(await aiResponse.json()).id,table:'resources'});
 const refreshed=page.waitForResponse(r=>r.url().includes('/api/resources?refresh=1'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
 await nav('AI常用网站');await page.locator('.website-category-toggle').first().waitFor();
 const group=page.locator('.website-category-group').filter({has:page.getByRole('heading',{name:'AI聊天',exact:true})}),toggle=group.locator('.website-category-toggle');
 await toggle.click();check(await toggle.getAttribute('aria-expanded')==='false'&&!await group.locator('.resource-grid').isVisible(),'AI category collapses');
 await toggle.click();check(await toggle.getAttribute('aria-expanded')==='true'&&await group.locator('.resource-grid').isVisible(),'AI category expands');
 await toggle.click();await page.getByRole('textbox',{name:'搜索常用网站',exact:true}).fill('折叠验证');check(await toggle.getAttribute('aria-expanded')==='true','search reveals matching collapsed category');
 await page.getByRole('textbox',{name:'搜索常用网站',exact:true}).fill('');await toggle.click();
 mkdirSync('outputs/browser-qa',{recursive:true});await page.screenshot({path:'outputs/browser-qa/ai-collapsible-v38.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile category page fits viewport');
 const marker=db.prepare("SELECT updated_at FROM app_state WHERE key='catalog-content-38'").get();await context.request.get(origin+'/api/resources');check(db.prepare("SELECT updated_at FROM app_state WHERE key='catalog-content-38'").get().updated_at===marker.updated_at,'editorial update does not repeat on reads');
 check(errors.length===0,'no browser errors '+errors.join(';'));console.log(JSON.stringify({catalogContentChecks:checks,browserErrors:errors}));
}finally{
 await browser.close();for(const row of fixtures){db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(row.id);if(row.table==='resources'){db.prepare('DELETE FROM resource_reads WHERE resource_id=?').run(row.id);db.prepare('DELETE FROM resources WHERE id=?').run(row.id);}else db.prepare('DELETE FROM team_websites WHERE id=?').run(row.id);}db.prepare('DELETE FROM sessions WHERE id=?').run(sessionId);db.close();
}
