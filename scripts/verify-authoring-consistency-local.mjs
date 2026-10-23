// Isolated local usability, presentation and role regression checks. No production secrets.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdirSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const origin='http://127.0.0.1:5173',dir=new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec('PRAGMA busy_timeout=10000');
const sessions=[],fixtures=[],teams=[],errors=[];let checks=0;
const browser=await chromium.launch({channel:'chrome',headless:true});const suffix=randomUUID().slice(0,8);
const check=(value,label)=>{assert(value,label);checks++;};
async function client(userId){const id=randomUUID(),token=randomBytes(32).toString('hex'),now=Math.floor(Date.now()/1000);sessions.push(id);db.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').run(id,userId,createHash('sha256').update(token).digest('hex'),now+1800,now);const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'dida_ai_session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
async function api(client,path,method='GET',data,status=200){const response=await client.context.request.fetch(origin+path,{method,...(data?{data}:{})});const result=await response.json();assert.equal(response.status(),status,JSON.stringify(result));checks++;if(status===201)(path==='/api/team-websites'?teams:fixtures).push(result.id);return result;}
const base=(type)=>({type,name:type+'-'+suffix,summary:'本地创建流程验证',slug:'test-'+randomUUID(),version:'1.0.0',installationMode:'none',resourceModule:'overseas',contact:'测试',usageExample:'使用说明',businessDirection:'technical_operations',accessMethod:'Streamable HTTP',sourceUrl:'https://example.com',detail:'适用说明'});
try{
 const creator=await client('usr-lumino'),admin=await client('usr-ruby'),viewer=await client('usr-kristine'),page=creator.page;
 for(const type of ['SKILL','MCP','AGENT','OTHER','INTERNAL']){
  const body=base(type);if(type==='OTHER'){body.resourceModule='other';body.scenario='模板';}if(type==='INTERNAL'){body.scenario='ai_tools';body.websiteCategoryId='ai-chat';}
  const fixture=await api(admin,'/api/resources','POST',body,201);
  await api(creator,'/api/resources/'+fixture.id,'PUT',{summary:'Creator 编辑所有类型 '+type});
  await api(viewer,'/api/resources/'+fixture.id,'PUT',{summary:'Forbidden'},403);
  await api(creator,'/api/resources/'+fixture.id,'DELETE',undefined,403);
 }
 const draft=await api(admin,'/api/resources','POST',base('MCP'),201);db.prepare("UPDATE resources SET status='DRAFT' WHERE id=?").run(draft.id);
 await api(creator,'/api/resources/'+draft.id+'/detail','GET',undefined,404);await api(creator,'/api/resources/'+draft.id,'PUT',{summary:'Forbidden'},403);
 const team=await api(admin,'/api/team-websites','POST',{teamId:'onboarding',name:'共享网站-'+suffix,description:'原始用途',url:'https://example.com/'+suffix},201);
 await api(creator,'/api/team-websites/'+team.id,'PUT',{name:'共享网站-'+suffix,description:'Creator 可修改各组网站',url:'https://example.com/'+suffix});
 await api(creator,'/api/team-websites/'+team.id,'DELETE',undefined,403);
 await api(creator,'/api/team-websites','POST',{teamId:'agoda',name:'Creator 添加-'+suffix,description:'跨组创建权限',url:'https://example.com/'+randomUUID()},201);
 await api(viewer,'/api/team-websites/'+team.id,'PUT',{name:'Forbidden',description:'禁止修改',url:'https://example.com'},403);
 await page.goto(origin);await page.locator('.resource-card').first().waitFor();
 const nav=name=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
 for(const [label,type] of [['Skills','SKILL'],['MCP','MCP'],['Agent','AGENT']]){await nav(label);await page.getByRole('button',{name:'创建资源',exact:true}).click();await page.getByLabel('资源类型',{exact:true}).waitFor();check(await page.getByLabel('资源类型',{exact:true}).inputValue()===type,'catalog creation presets '+type);await page.getByRole('button',{name:'取消',exact:true}).click();}
 await nav('Data MCP');await page.locator('.mcp-tools-section').waitFor();
 const headingStyle=await page.locator('.resource-page-layout main').evaluate(main=>['h2','.mcp-tools-section summary','.mcp-data-section summary'].map(selector=>{const s=getComputedStyle(main.querySelector(selector));return [s.fontSize,s.fontWeight,s.color];}));
 check(JSON.stringify(headingStyle[0])===JSON.stringify(headingStyle[1])&&JSON.stringify(headingStyle[1])===JSON.stringify(headingStyle[2]),'MCP section titles have identical typography '+JSON.stringify(headingStyle));
 check(await page.locator('.mcp-tools-section details').evaluate(e=>getComputedStyle(e).borderTopWidth)==='0px','MCP separator removed');
 check(await page.locator('.mcp-evidence-note').count()===0,'table footer text removed');
 check(await page.locator('.mcp-data-section td code').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=13),'readable table code');
 await page.getByRole('button',{name:'编辑资源',exact:true}).click();await page.locator('.resource-editor-form').waitFor();
 check(await page.getByRole('textbox',{name:/^工具 \d+ 名称$/}).count()===6,'Data MCP editor has six tool rows');
 check(await page.getByRole('textbox',{name:/^数据 \d+ 名称$/}).count()===37,'Data MCP editor has every table');
 check(await page.locator('textarea[name=usageExample],select[name=businessDirection],input[name=sourceUrl],textarea[name=mcpRequirements],textarea[name=detail]').count()===0,'MCP does not ask for Skill or Agent-only content');
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await nav('我创建的');await page.getByRole('button',{name:'发布资源',exact:true}).click();await page.getByLabel('资源类型',{exact:true}).selectOption('MCP');
 await page.locator('input[name=name]').fill('MCP 界面验证-'+suffix);await page.locator('textarea[name=summary]').fill('自定义工具与数据范围');await page.getByLabel('安装方式',{exact:true}).selectOption('none');await page.locator('textarea[name=accessMethod]').fill('Streamable HTTP，只读接入。');
 await page.getByRole('button',{name:'添加工具',exact:true}).click();await page.getByRole('textbox',{name:'工具 1 名称',exact:true}).fill('constructor');await page.getByRole('textbox',{name:'工具 1 功能说明',exact:true}).fill('检索自定义业务对象。');
 await page.getByRole('button',{name:'添加工具',exact:true}).click();await page.getByRole('textbox',{name:'工具 2 名称',exact:true}).fill('constructor');await page.getByRole('textbox',{name:'工具 2 功能说明',exact:true}).fill('重复名称验证。');
 await page.getByRole('button',{name:'添加数据范围',exact:true}).click();await page.getByRole('textbox',{name:'数据 1 名称',exact:true}).fill('public.example');await page.getByRole('textbox',{name:'数据 1 作用',exact:true}).fill('业务对象明细，仅查询授权范围。');
 const duplicate=page.waitForResponse(r=>r.url()===origin+'/api/resources'&&r.request().method()==='POST');await page.getByRole('button',{name:'保存资源',exact:true}).click();check((await duplicate).status()===400,'duplicate tool rejected');await page.locator('.form-error').waitFor();check(await page.locator('.form-error').evaluate(e=>e===document.activeElement),'save error receives accessible focus');
 await page.getByRole('button',{name:'移除工具 2',exact:true}).click();const saveMcp=page.waitForResponse(r=>r.url()===origin+'/api/resources'&&r.request().method()==='POST');await page.getByRole('button',{name:'保存资源',exact:true}).click();const response=await saveMcp;check(response.status()===201,'MCP saved without unused Skill fields');const mcpId=(await response.json()).id;fixtures.push(mcpId);
 await page.locator('.resource-card').filter({has:page.getByRole('heading',{name:'MCP 界面验证-'+suffix,exact:true})}).click();await page.getByText('检索自定义业务对象。',{exact:true}).waitFor();check(await page.getByText('业务对象明细，仅查询授权范围。',{exact:true}).isVisible(),'custom table purpose round trips');
 mkdirSync('outputs/browser-qa',{recursive:true});await page.screenshot({path:'outputs/browser-qa/mcp-readable-v39.png',fullPage:true});
 const persisted=(await api(creator,'/api/resources/'+mcpId+'/detail')).resource;check(persisted.toolDescriptions.constructor==='检索自定义业务对象。'&&persisted.usageExample===null&&persisted.repositoryAccess==='none','typed MCP payload persisted cleanly');
 await nav('我创建的');await page.getByRole('button',{name:'发布资源',exact:true}).click();await page.getByLabel('资源类型',{exact:true}).selectOption('AGENT');
 check(await page.locator('textarea[name=installationCommand],textarea[name=mcpRequirements],input[name=caseUrl],input[name=documentationUrl],select[name=businessDirection]').count()===0,'Agent removes redundant setup and duplicate document fields');
 await page.locator('input[name=name]').fill('Agent 界面验证-'+suffix);await page.locator('textarea[name=summary]').fill('私有知识库助手');await page.locator('input[name=sourceUrl]').fill('https://example.com/chat');await page.locator('textarea[name=detail]').fill('适合查询私有知识库中的问题。');await page.locator('input[name=referenceUrl]').fill('https://example.com/docs');
 check(await page.locator('textarea[name=usageExample]').inputValue()==='进入对话界面开启对话即可。','useful Agent usage default');
 const saveAgent=page.waitForResponse(r=>r.url()===origin+'/api/resources'&&r.request().method()==='POST');await page.getByRole('button',{name:'保存资源',exact:true}).click();const agentResponse=await saveAgent;check(agentResponse.status()===201,'Agent saves with only relevant fields');fixtures.push((await agentResponse.json()).id);
 await page.locator('.resource-card').filter({has:page.getByRole('heading',{name:'Agent 界面验证-'+suffix,exact:true})}).click();await page.getByText('适合查询私有知识库中的问题。',{exact:true}).waitFor();check(await page.getByRole('link',{name:'查看使用文档',exact:true}).getAttribute('href')==='https://example.com/docs','Agent document appears exactly once');check(await page.getByRole('heading',{name:'安装前准备',exact:true}).count()===0,'Agent no stale prerequisite section');
 await nav('网站');await page.getByRole('heading',{name:'网站',exact:true}).waitFor();check(await page.locator('.website-overview-group').count()===3,'website overview presents three distinct directories');
 await page.locator('.website-overview-group').last().locator('.shortcut-circle').first().waitFor();check(await page.locator('.website-overview-group').last().locator('.shortcut-circle').count()===2,'team overview retains initial circles');check(await page.locator('.website-overview-group.ai-site-directory').count()===1,'AI overview uses compact directory styles');
 check(await page.getByRole('button',{name:'查看与管理',exact:true}).count()===3,'each website group has a management entry');await page.screenshot({path:'outputs/browser-qa/website-overview-v39.png',fullPage:true});await page.getByRole('button',{name:'查看与管理',exact:true}).nth(2).click();await page.locator('.shortcut-group').first().waitFor();
 check(await page.locator('.shortcut-group').getByRole('button',{name:'添加网站',exact:true}).count()===6,'Creator can add within every team');
 const firstGroup=page.locator('.shortcut-group').first();check(await firstGroup.locator('.shortcut-group-toggle').evaluate(e=>e.firstElementChild.tagName.toLowerCase()==='svg'),'team disclosure before label');
 const row=page.locator('.nav-type-row').first();check((await row.locator('.nav-disclosure').boundingBox()).x<(await row.locator('.nav-type-link').boundingBox()).x,'sidebar disclosure before label');
 await nav('MCP');await page.getByRole('heading',{name:'MCP',exact:true}).waitFor();const tiger=page.locator('.resource-card').filter({has:page.getByRole('heading',{name:'tiger-mcp',exact:true})});const cardColor=await tiger.locator('.resource-icon').evaluate(e=>getComputedStyle(e).color);await tiger.click();await page.locator('.resource-page-hero').waitFor();check(await page.locator('.resource-page-hero>.resource-icon').evaluate(e=>getComputedStyle(e).color)===cardColor,'MCP icon color matches between catalog and detail');
 await page.getByRole('button',{name:'编辑资源',exact:true}).click();await page.locator('.mcp-row-editor').first().waitFor();await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'structured editor fits mobile');await page.screenshot({path:'outputs/browser-qa/mcp-editor-mobile-v39.png',fullPage:true});
 check(errors.length===0,'no runtime errors '+errors.join(';'));console.log(JSON.stringify({authoringConsistencyChecks:checks,browserErrors:errors}));
}finally{await browser.close();for(const id of fixtures){db.prepare('DELETE FROM resource_reads WHERE resource_id=?').run(id);db.prepare('DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?').run(id,id);db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(id);db.prepare('DELETE FROM resources WHERE id=?').run(id);}for(const id of teams){db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(id);db.prepare('DELETE FROM team_websites WHERE id=?').run(id);}for(const id of sessions)db.prepare('DELETE FROM sessions WHERE id=?').run(id);db.close();}
