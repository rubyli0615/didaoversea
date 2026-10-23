// Isolated local browser/API verification. No production credentials or records are used.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const origin='http://127.0.0.1:5173',dir=new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec('PRAGMA busy_timeout = 10000');
const sessions=[],resources=[],websites=[];let checks=0;
const check=(ok,message)=>{assert(ok,message);checks++;};
const browser=await chromium.launch({channel:'chrome',headless:true});
async function login(userId){
 const token=randomBytes(32).toString('hex'),id=randomUUID(),now=Math.floor(Date.now()/1000);sessions.push(id);
 db.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').run(id,userId,createHash('sha256').update(token).digest('hex'),now+900,now);
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'dida_ai_session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();await page.goto(origin);await page.locator('.sidebar').waitFor();return {page,context,api:context.request};
}
async function nav(page,name){await page.locator('.sidebar').getByRole('button',{name,exact:true}).click();}
try{
 const creator=await login('usr-lea'),viewer=await login('usr-william'),admin=await login('usr-ruby');
 const initial=await (await admin.api.get(origin+'/api/resources')).json();
 for(const [slug,description] of [['angrybirds','CRM'],['analysis','日志分析'],['content','静态信息'],['tiger-v2','订单管理'],['wolf-v1','接口测试'],['wolf-v2','资源配置'],['quickbi','BI 报表']])check(initial.resources.find(r=>r.slug===slug)?.summary.includes(description),'functional description for '+slug);
 for(const [label,scenario] of [['海外OP常用网站','overseas_op'],['AI常用网站','ai_tools']]){
  await nav(creator.page,label);await creator.page.locator('.common-websites-page').waitFor();
  check(await creator.page.getByRole('button',{name:'添加网站',exact:true}).count()===1,'Creator add button on '+label);
  await creator.page.getByRole('button',{name:'添加网站',exact:true}).click();
  check((await creator.page.locator('dialog [name]').evaluateAll(es=>es.map(e=>e.name))).join('|')==='name|description|websiteCategoryId|url','website fields include category in correct order');
  await creator.page.locator('dialog select[name=websiteCategoryId]').selectOption(scenario==='overseas_op'?'op-data':'ai-chat');
  await creator.page.locator('dialog input[name=name]').fill('Alpha QA '+scenario);await creator.page.locator('dialog textarea[name=description]').fill('查询酒店订单状态与处理记录');await creator.page.locator('dialog input[name=url]').fill('https://example.com/'+randomUUID());
  const response=creator.page.waitForResponse(r=>r.url()===origin+'/api/resources'&&r.request().method()==='POST');await creator.page.getByRole('button',{name:'保存网站',exact:true}).click();const saved=await response;check(saved.status()===201,'create common website '+scenario);const id=(await saved.json()).id;resources.push(id);
  await creator.page.getByRole('heading',{name:'Alpha QA '+scenario,exact:true}).waitFor();
  if(scenario==='overseas_op'){
   check(await creator.page.locator('.common-websites-page .shortcut-circle').count()===0,'OP websites keep original icons');
   const marks=creator.page.locator('.common-websites-page .website-card-heading .website-mark');check(await marks.count()>0&&await marks.evaluateAll(es=>es.every(e=>e.getAttribute('src')==='/website-mark.png'&&e.complete&&e.naturalWidth>0)),'original website icon loaded on '+label);
  }else{
   const circles=creator.page.locator('.common-websites-page .website-card-heading .shortcut-circle');check(await circles.count()>0&&await circles.evaluateAll(es=>es.every(e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgb(0, 8, 70)'&&s.color==='rgb(255, 255, 255)'&&s.borderRadius==='50%'&&s.width==='36px'&&s.height==='36px';})),'AI uses identical blue/white team circles');
   check(await circles.first().innerText()==='A'&&await creator.page.locator('.common-websites-page .website-mark').count()===0,'AI circle contains name initial instead of original mark');
  }
  const listing=await (await viewer.api.get(origin+'/api/resources?refresh=1')).json(),site=listing.resources.find(r=>r.id===id);
  check(site?.status==='PUBLISHED'&&site.scenario===scenario&&site.summary==='查询酒店订单状态与处理记录'&&!site.version,'Creator website visible to everyone, no fake version');
  check((await viewer.api.post(origin+'/api/resources',{data:{type:'INTERNAL',scenario,websiteCategoryId:scenario==='overseas_op'?'op-data':'ai-chat',name:'Forbidden',summary:'功能',sourceUrl:'https://example.com',slug:'forbidden-'+randomUUID()}})).status()===403,'Viewer cannot create common site');
  check((await creator.api.post(origin+'/api/resources',{data:{type:'INTERNAL',scenario,name:'Empty description',summary:' ',sourceUrl:'https://example.com',slug:'invalid-'+randomUUID()}})).status()===400,'function description required server-side');
  check((await admin.api.put(origin+'/api/resources/'+id,{data:{summary:'管理员补充的网站功能'}})).status()===200,'admin may maintain site');
  check((await viewer.api.put(origin+'/api/resources/'+id,{data:{summary:'Forbidden'}})).status()===403,'Viewer cannot edit common site');
  check((await creator.api.put(origin+'/api/resources/site-angrybirds',{data:{websiteCategoryId:'op-data'}})).status()===200,'Creator may categorize existing website from another author');
  const ownCard=creator.page.locator('.website-directory-item').filter({has:creator.page.getByRole('heading',{name:'Alpha QA '+scenario,exact:true})});await ownCard.getByRole('button',{name:'编辑',exact:true}).click();await creator.page.locator('dialog textarea[name=description]').fill('维护订单查询入口');
  const update=creator.page.waitForResponse(r=>r.url()===origin+'/api/resources/'+id&&r.request().method()==='PUT');await creator.page.getByRole('button',{name:'保存网站',exact:true}).click();check((await update).status()===200,'Creator edits own website directly');await ownCard.getByText('维护订单查询入口',{exact:true}).waitFor();
  await nav(viewer.page,label);await viewer.page.locator('.common-websites-page').waitFor();check(await viewer.page.getByRole('button',{name:'添加网站',exact:true}).count()===0,'no add on common page for leader-only account');
  for(const group of await creator.page.locator('.website-category-group').all()){const names=await group.locator('.website-card-heading h3').allTextContents();check(names.join('|')===[...names].sort((a,b)=>a.localeCompare(b,'zh-CN',{sensitivity:'base',numeric:true})).join('|'),'common sites sorted within category');}
  await creator.page.setViewportSize({width:390,height:844});check(await creator.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'common directory mobile width');await creator.page.setViewportSize({width:1440,height:1000});
 }
 await nav(creator.page,'我创建的');await creator.page.getByRole('button',{name:'发布资源',exact:true}).click();check(!(await creator.page.locator('select').first().locator('option').allTextContents()).includes('网站'),'website creation removed from resource publisher');await creator.page.getByRole('button',{name:'取消',exact:true}).click();
 await nav(creator.page,'其他有用网站');await creator.page.locator('.shortcut-group').first().waitFor();check(await creator.page.getByRole('button',{name:'添加网站',exact:true}).count()===6,'Creator can create sites in every team');
 const descriptions=['查询数据与导出报表','维护订单处理记录','查询客户配置'];
 for(const [index,name] of ['zeta','Alpha','客户工作台'].entries()){
  const response=await admin.api.post(origin+'/api/team-websites',{data:{teamId:'data',name,description:descriptions[index],url:'https://example.com/'+randomUUID()}});check(response.status()===201,'group website description saved');websites.push((await response.json()).id);
 }
 check((await admin.api.post(origin+'/api/team-websites',{data:{teamId:'data',name:'Missing',url:'https://example.com/missing'}})).status()===400,'group website requires description');
 await nav(admin.page,'其他有用网站');const group=admin.page.locator('.shortcut-group').filter({has:admin.page.getByRole('heading',{name:'数据组',exact:true})});await group.locator('.website-shortcut').filter({has:admin.page.getByRole('link',{name:'Alpha',exact:true})}).waitFor();
 const labels=await group.locator('.website-shortcut b').allTextContents();check(labels.join('|')===[...labels].sort((a,b)=>a.localeCompare(b,'zh-CN',{sensitivity:'base',numeric:true})).join('|'),'group website alphabetical order');
 for(const [name,description,initial] of [['zeta',descriptions[0],'Z'],['Alpha',descriptions[1],'A'],['客户工作台',descriptions[2],'客']]){
  const link=group.getByRole('link',{name,exact:true});check(await link.getAttribute('title')===description,'tooltip is description for '+name);const circle=link.locator('.shortcut-circle');check(await circle.innerText()===initial,'initial for '+name);const style=await circle.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));check(style.bg==='rgb(0, 8, 70)'&&style.color==='rgb(255, 255, 255)'&&await circle.locator('img').count()===0,'uniform blue/white initial with no favicon');
 }
 await group.getByRole('button',{name:'编辑 Alpha',exact:true}).click();await admin.page.locator('dialog textarea[name=description]').fill('更新后的功能说明');const editTeam=admin.page.waitForResponse(r=>r.url().startsWith(origin+'/api/team-websites/')&&r.request().method()==='PUT');await admin.page.getByRole('button',{name:'保存网站',exact:true}).click();check((await editTeam).status()===200,'team description editable');await group.locator('a[title="更新后的功能说明"]').waitFor();check(await group.getByRole('link',{name:'Alpha',exact:true}).getAttribute('title')==='更新后的功能说明','updated team description reaches tooltip');
 await admin.page.screenshot({path:'outputs/browser-qa/websites-updated.png',fullPage:true});
 await nav(creator.page,'海外OP常用网站');await creator.page.screenshot({path:'outputs/browser-qa/common-websites-updated.png',fullPage:true});
 console.log(`Website directory verification: ${checks} browser and API checks passed.`);
} finally {
 await browser.close();for(const id of websites){db.prepare('DELETE FROM team_websites WHERE id=?').run(id);db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(id);}
 for(const id of resources){db.prepare('DELETE FROM resource_reads WHERE resource_id=?').run(id);db.prepare('DELETE FROM resources WHERE id=?').run(id);db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(id);}
 for(const id of sessions)db.prepare('DELETE FROM sessions WHERE id=?').run(id);db.close();
}
