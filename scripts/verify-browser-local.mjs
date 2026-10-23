import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { readdirSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { importSource } from './ts-module-loader.mjs';
const { TIGER_MCP_INSTALL, DATA_MCP_INSTALL, TIGER_MCP_TOOLS, DATA_MCP_TOOLS } = await importSource('../lib/mcp-content.ts', import.meta.url);
const { WEBSITE_TEAMS }=await importSource("../lib/team-websites.ts",import.meta.url);
const { orderedWebsites }=await importSource("../lib/website-layout.ts",import.meta.url);
import { chromium } from 'file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const origin='http://127.0.0.1:5173';
const dir=new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));
db.exec('PRAGMA busy_timeout = 10000');
const ids=[], websites=[], resources=[], errors=[];
const out=new URL('../outputs/browser-qa/',import.meta.url); mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
let checks=0;
let loginFixtureId;
const check=(c,m)=>{assert(c,m);checks++;};
async function login(id,width=1440){
 const token=randomBytes(32).toString('hex'),sid=randomUUID(),now=Math.floor(Date.now()/1000);ids.push(sid);
 db.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').run(sid,id,createHash('sha256').update(token).digest('hex'),now+1200,now);
 const context=await browser.newContext({viewport:{width,height:1000}});
 await context.addCookies([{name:'dida_ai_session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin); await page.getByRole('button',{name:'Skills',exact:true}).waitFor();check(await page.locator('.resource-card .tag-row').count()===0,'resource cards contain no keyword badges');
 const brand=page.locator('.sidebar .brand-home>span');check(await brand.innerText()==='海外渠道AI资源工作台','workspace brand title renamed');
 const brandStyle=await brand.evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,size:s.fontSize,weight:s.fontWeight,font:s.fontFamily,fits:el.scrollWidth<=el.clientWidth};});
 check(brandStyle.color==='rgb(0, 8, 70)'&&brandStyle.size==='16px'&&Number(brandStyle.weight)>=700&&brandStyle.font.includes('Arial')&&brandStyle.fits,'navy sans-serif brand title fits sidebar and stands apart from menu');
 return {page,context};
}
async function directory(page){await page.getByRole('button',{name:'其他有用网站',exact:true}).click(); await page.locator('.shortcut-group').first().waitFor();check(await page.locator('.sidebar').getByRole('button',{name:'其他有用网站',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(238, 240, 248)','nested navigation blue active');}
try {
 const loginContext=await browser.newContext({viewport:{width:1440,height:1000}});
 const loginPage=await loginContext.newPage();await loginPage.goto(origin);await loginPage.getByLabel('登录账号',{exact:true}).waitFor();
 check(await loginPage.getByLabel('登录账号',{exact:true}).inputValue()==='','login account starts empty');
 check(await loginPage.getByText('企业账号',{exact:true}).count()===0,'login account label corrected');
 await loginPage.getByLabel('登录账号',{exact:true}).fill('william.xia@dida.com');check(await loginPage.getByLabel('登录账号',{exact:true}).inputValue()==='William.xia@dida.com','typed account formatted with uppercase first letter');
 await loginPage.screenshot({path:new URL('login-account.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
 loginFixtureId='login-case-'+randomUUID();const fixtureEmail='case.'+randomUUID()+'@dida.com',fixtureKey=randomBytes(24).toString('hex'),salt=randomBytes(16),now=Math.floor(Date.now()/1000);
 db.prepare('INSERT INTO users (id,email,display_name,role,active,key_salt,key_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(loginFixtureId,fixtureEmail,'Login QA','VIEWER',1,salt.toString('hex'),pbkdf2Sync(fixtureKey,salt,100000,32,'sha256').toString('hex'),now,now);
 for(const email of [fixtureEmail,fixtureEmail.toUpperCase()])check((await loginContext.request.post(origin+'/api/auth/login',{data:{email,key:fixtureKey}})).status()===200,'same Key accepts mixed account casing');
 await loginContext.clearCookies();await loginPage.getByLabel('登录账号',{exact:true}).fill(fixtureEmail);await loginPage.getByLabel('Access Key',{exact:true}).fill(fixtureKey);await loginPage.getByRole('button',{name:'进入资源中心',exact:true}).click();await loginPage.locator('.sidebar').waitFor();check(await loginPage.locator('.user-card b').innerText()==='Login QA','capitalized account logs in through browser');
 await loginContext.close();
 // All six leaders get only their own group action. Original Creator roles remain.
 for(const [id,group,creator] of [['usr-jason-huang','AI&项目组',true],['usr-lumino','数据组',true],['usr-banks','新客户上线组',false],['usr-william','亚太中东运营组',false],['usr-jeffee','欧美运营组',false],['usr-kelly','Agoda运营组',false]]){
  const {page,context}=await login(id);await directory(page);
  check(await page.getByRole('button',{name:'账号管理',exact:true}).count()===0,id+' no account admin');
  check(await page.getByRole('button',{name:'我创建的',exact:true}).count()===(creator?1:0),id+' baseline Creator rights');
  check(await page.getByRole('button',{name:'添加网站',exact:true}).count()===(creator?6:1),id+' Creator gets all groups; Viewer leader only own');
  check(await page.locator('.shortcut-group').filter({has:page.getByRole('heading',{name:group,exact:true})}).getByRole('button',{name:'添加网站'}).count()===1,id+' correct group');
  const currentLayout=(await (await context.request.get(origin+'/api/website-layout')).json()).layouts.find(item=>item.scenario==='teams');const expectedOrder=orderedWebsites(WEBSITE_TEAMS,currentLayout?.groupIds?.length?currentLayout.groupIds:WEBSITE_TEAMS.map(team=>team.id)).map(team=>team.name).join('|');check((await page.locator('.shortcut-group h2').allTextContents()).join('|')===expectedOrder,'saved group order or stable default');
  if(id==='usr-william'){
   await page.getByRole('button',{name:'添加网站',exact:true}).click();
   await page.locator('dialog input[name=name]').fill('浏览器验证入口');await page.locator('dialog textarea[name=description]').fill('查询本组业务数据');await page.locator('dialog input[name=url]').fill('https://example.com/browser-qa');
   const response=page.waitForResponse(r=>r.url()===origin+'/api/team-websites'&&r.request().method()==='POST');
   await page.getByRole('button',{name:'保存网站',exact:true}).click();const saved=await response;check(saved.status()===201,'website created in browser');websites.push((await saved.json()).id);
   await page.getByRole('link',{name:'浏览器验证入口'}).waitFor();
   const circle=page.locator('.website-shortcut').filter({hasText:'浏览器验证入口'}).locator('.shortcut-circle');
   const shape=await circle.evaluate(e=>{const s=getComputedStyle(e);return {w:e.clientWidth,h:e.clientHeight,r:s.borderRadius};});
   check(shape.w===shape.h&&shape.r==='50%','actual circular shortcut');
   await page.screenshot({path:new URL('team-lead.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
   await page.getByRole('button',{name:'收起导航栏'}).click();check(!(await page.locator('.sidebar').isVisible()),'sidebar collapsed');
   await page.getByRole('button',{name:'展开导航栏'}).click();check(await page.locator('.sidebar').isVisible(),'sidebar expanded');
  }
  await context.close();
 }
 const admin=await login('usr-ruby');await admin.page.getByRole('button',{name:'账号管理',exact:true}).click();await admin.page.locator('.user-row:not(.header)').first().waitFor();const accountNames=await admin.page.locator('.user-row:not(.header) small').allTextContents();check(accountNames.length>=23&&accountNames.every(e=>/^[A-Z]/.test(e)),'all account list entries capitalized');await directory(admin.page);
 check(await admin.page.getByRole('button',{name:'添加网站',exact:true}).count()===6,'Ruby can add websites in all groups');
 const rubyGroup=admin.page.locator('.shortcut-group').filter({has:admin.page.getByRole('heading',{name:'数据组',exact:true})});
 await rubyGroup.getByRole('button',{name:'添加网站'}).click();await admin.page.locator('dialog input[name=name]').fill('Ruby 本地验证');await admin.page.locator('dialog textarea[name=description]').fill('管理员维护的团队入口');await admin.page.locator('dialog input[name=url]').fill('https://example.com/ruby-qa');
 const rubyResponse=admin.page.waitForResponse(r=>r.url()===origin+'/api/team-websites'&&r.request().method()==='POST');await admin.page.getByRole('button',{name:'保存网站',exact:true}).click();const rubySaved=await rubyResponse;check(rubySaved.status()===201,'Ruby can actually save group website');websites.push((await rubySaved.json()).id);
 await admin.page.getByRole('link',{name:'Ruby 本地验证'}).waitFor();await admin.page.screenshot({path:new URL('ruby-websites.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});await admin.context.close();
 const viewer=await login('usr-kristine');await directory(viewer.page);check(await viewer.page.getByRole('button',{name:'添加网站',exact:true}).count()===0,'member cannot add');await viewer.context.close();
 const {page,context}=await login('usr-lumino',1680);
 const fonts=await page.locator('.sidebar').evaluate(el=>{const b=[...el.querySelectorAll('button')];return [b.find(e=>e.textContent==='DIDA AI资源'),b.find(e=>e.textContent==='Skills'),b.find(e=>e.textContent==='其他有用网站')].map(e=>parseFloat(getComputedStyle(e).fontSize));});check(fonts[0]===14&&fonts[1]===14&&fonts[2]===13.5,'darker navigation text one size larger');
 check(await page.locator('.sidebar-toggle svg.lucide-arrow-left-to-line').count()===1,'reference-style collapse arrow');
 const upperPositions=async()=>page.locator('.sidebar').evaluate(el=>{const rect=e=>{const r=e.getBoundingClientRect();return {y:r.y,h:r.height};};return {logo:rect(el.querySelector('.brand-logo')),title:rect(el.querySelector('.brand-home>span')),dida:rect([...el.querySelectorAll('button')].find(e=>e.textContent==='DIDA AI资源'))};});
 for(const height of [900,768,600]){
  await page.setViewportSize({width:1680,height});await page.locator('.hierarchy-nav').evaluate(e=>e.scrollTop=0);const before=await upperPositions();
  const agent=page.locator('.sidebar').getByRole('button',{name:'展开或收起 Agent',exact:true});await agent.click();const expanded=await upperPositions();
  check(['logo','title','dida'].every(k=>Math.abs(before[k].y-expanded[k].y)<1&&Math.abs(before[k].h-expanded[k].h)<1),'upper content stable when Agent expands at height '+height);
  await agent.click();const after=await upperPositions();check(['logo','title','dida'].every(k=>Math.abs(before[k].y-after[k].y)<1),'upper content stable on collapse at height '+height);
  const website=page.locator('.sidebar').getByRole('button',{name:'展开或收起 网站',exact:true});await website.click();await website.click();const afterWebsite=await upperPositions();check(['logo','title','dida'].every(k=>Math.abs(before[k].y-afterWebsite[k].y)<1),'upper content stable when website toggles at height '+height);
 }
 const navStyle=await page.locator('.sidebar').evaluate(el=>{const n=el.querySelector('.hierarchy-nav');const b=[...el.querySelectorAll('button')].find(e=>e.textContent==='Tiger MCP');return {overflow:getComputedStyle(el).overflowY,navOverflow:getComputedStyle(n).overflowY,color:getComputedStyle(b).color};});check(navStyle.overflow==='hidden'&&navStyle.navOverflow==='auto'&&navStyle.color==='rgb(52, 64, 84)','menu scrolls independently with dark text');
 await page.setViewportSize({width:1680,height:1000});const rail=await page.locator('.sidebar').boundingBox(),toggleBox=await page.locator('.sidebar-toggle').boundingBox();check(toggleBox.x-(rail.x+rail.width)<=16,'collapse control shifted left');
 for(const [name,command,tools] of [['Tiger MCP',TIGER_MCP_INSTALL,TIGER_MCP_TOOLS],['Data MCP',DATA_MCP_INSTALL,DATA_MCP_TOOLS]]){
  await page.locator('.sidebar').getByRole('button',{name,exact:true}).click();await page.locator('.mcp-tools-section').waitFor();await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'复制安装指令',exact:true}).click();await page.getByRole('button',{name:'复制安装指令',exact:true}).getByText('已复制',{exact:true}).waitFor();const copiedCommand=await page.evaluate(()=>navigator.clipboard.readText());check(copiedCommand.replaceAll('\r\n','\n')===command.replaceAll('\r\n','\n'),name+' exact installation text');check(JSON.stringify(await page.locator('.mcp-tools-section tbody tr td:first-child code').allTextContents())===JSON.stringify(tools),name+' exact tool IDs');
  check(await page.locator('.mcp-evidence-note').count()===0,'unrequested table footer removed');
  if(name==='Data MCP')check(await page.locator('.mcp-connection-section').getByRole('link',{name:'查看使用文档',exact:true}).getAttribute('href')==='https://didatravel.feishu.cn/docx/QZ7wdlt0joYPuExZZovcxUNknxf','data documentation link');
  await page.screenshot({path:new URL(name==='Tiger MCP'?'tiger-mcp.png':'data-mcp.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
 }
 await page.getByRole('button',{name:'Skills',exact:true}).click();await page.locator('.resource-card').filter({hasText:'产量异动归因'}).click();
 await page.getByRole('heading',{name:'资源介绍',exact:true}).waitFor();
 for(const [width,height] of [[1680,1000],[900,900],[390,844]]){
  await page.setViewportSize({width,height});
  const hero=await page.locator('.resource-page-hero').evaluate(el=>{const rect=s=>{const r=el.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom};};return {icon:rect('.resource-icon'),title:rect('h1'),badges:rect('.detail-badges'),summary:rect('p'),overflow:document.documentElement.scrollWidth>innerWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))};});
  check(Math.abs(hero.icon.y+hero.icon.h/2-hero.title.y-hero.title.h/2)<1,'detail icon vertically centered on title at '+width);
  check(hero.badges.b<=hero.title.y&&hero.summary.y>=Math.max(hero.icon.b,hero.title.b)&&!hero.overflow,'detail metadata and summary do not overlap title at '+width+': '+JSON.stringify(hero));
  check(Math.abs(hero.badges.x-hero.title.x)<1&&(width<720||Math.abs(hero.summary.x-hero.title.x)<1),'detail text alignment at '+width);
  await page.locator('.resource-page-hero').screenshot({path:new URL('detail-header-'+width+'.png',out).pathname.replace(/^\/(.:)/,'$1')});
 }
 await page.setViewportSize({width:1680,height:1000});
 const titles=await page.locator('.resource-page-layout>main>.resource-content-card>h2').allTextContents();
 check(titles.join('|')==='资源介绍|安装前准备|安装指令|如何使用|Skill 关联','detail reading order');
 check(await page.locator('.relation-current').count()===1,'current skill in relation chain');
 check(!(await page.locator('.resource-side dd').first().innerText()).includes('@'),'name-only contact');
 const colors=await page.locator('.resource-side .side-primary,.resource-side .side-action,.resource-side .side-edit').evaluateAll(es=>es.filter(e=>!e.disabled).map(e=>getComputedStyle(e).backgroundColor));
 check(new Set(colors).size===1&&colors[0]==='rgb(0, 8, 70)','enabled actions use unified blue');
 check(await page.getByRole('link',{name:'查看输出文档示例'}).count()===1,'output example distinct');
 await page.screenshot({path:new URL('skill-detail.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
 await page.locator('.sidebar').getByRole('button',{name:'Skills',exact:true}).click();await page.locator('.resource-card').filter({hasText:'大盘产量异动分析报警'}).click();
 await page.locator('.relation-empty').first().waitFor();check(await page.getByText('无推荐前置',{exact:true}).count()===1,'missing predecessor has clear label');
 const cards=await page.locator('.skill-relation-chain').evaluate(el=>[...el.querySelectorAll('.relation-stage')].map(stage=>{const card=stage.children[1],s=getComputedStyle(card),r=card.getBoundingClientRect();return {top:r.top,height:r.height,border:s.borderWidth,bg:s.backgroundColor};}));
 check(cards.every(c=>Math.abs(c.top-cards[0].top)<1&&Math.abs(c.height-cards[0].height)<1),'all relation boxes aligned');
 check(cards[0].border!=='0px'&&cards[1].bg==='rgb(0, 8, 70)','empty box and deep-blue current card');
 await page.locator('.skill-relation-chain').screenshot({path:new URL('relation-alignment.png',out).pathname.replace(/^\/(.:)/,'$1')});
 await page.locator('.sidebar').getByRole('button',{name:'Skills',exact:true}).click();await page.locator('.resource-card').filter({hasText:'L2L 配置查询'}).click();
 const code=page.locator('.usage-instructions .usage-code code');check((await code.innerText()).startsWith('使用 l2l-downgrade'),'only example command in code box');
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'复制使用指令',exact:true}).click();check(await page.evaluate(()=>navigator.clipboard.readText())===await code.innerText(),'one-click copies exact usage command');
 await page.locator('.usage-instructions').screenshot({path:new URL('usage-command.png',out).pathname.replace(/^\/(.:)/,'$1')});
 const nav=await page.locator('.sidebar').evaluate(el=>{const b=[...el.querySelectorAll('button')];const a=b.find(e=>e.textContent==='DIDA AI资源'),o=b.find(e=>e.textContent==='其他');return {same:Math.abs(a.querySelector("span").getBoundingClientRect().left-o.querySelector("span").getBoundingClientRect().left)<1&&getComputedStyle(a).fontWeight===getComputedStyle(o).fontWeight,side:getComputedStyle(el).borderRightWidth,brand:getComputedStyle(el.querySelector('.brand-home')).borderBottomWidth,tree:getComputedStyle(el.querySelector('.nav-grandchildren')).borderLeftWidth};});
 check(nav.same&&nav.side==='0px'&&nav.brand==='0px'&&nav.tree==='0px','parallel root navigation without divider lines');
 // Category breadcrumbs, including Agent, navigate rather than decorative text.
 await page.getByRole('button',{name:'展开或收起 Agent',exact:true}).click();await page.getByRole('button',{name:'Dida API内部小助手',exact:true}).click();
 await page.locator('.resource-page-hero').waitFor();check(!(await page.locator('.detail-badges').innerText()).includes('v—'),'no placeholder version badge');
 check(!(await page.locator('.resource-side dl').innerText()).includes('版本'),'no placeholder version row');
 await page.locator('.page-breadcrumb').getByRole('button',{name:'Agent',exact:true}).click();await page.locator('.catalog-toolbar').waitFor();check(await page.locator('.resource-page').count()===0,'Agent breadcrumb navigates');
 await page.getByRole('button',{name:'我创建的',exact:true}).click();await page.getByRole('button',{name:'发布资源',exact:true}).click();await page.locator('.resource-editor-form .form-section').first().waitFor();
 const sections=await page.locator('.resource-editor-form>.form-section>h2').allTextContents();
 check(sections.join('|')==='基本信息|安装前准备|安装指令|使用方法|常见 Q&A|Skill 关联','publishing section order');
 check(await page.locator('input[name=contact]').inputValue()==='Lumino','contact automatically uses current account name');
 await page.locator('select[name=businessDirection]').selectOption('other');
 const box=await page.locator('.resource-editor-page').boundingBox(),canvas=await page.locator('.page-canvas').boundingBox();check(box.width>canvas.width*.9,'form uses available width');
 const a=await page.locator('select[name=businessDirection]').boundingBox(),b=await page.locator('input[name=scenario]').boundingBox();check(Math.abs(a.y-b.y)<1&&Math.abs(a.height-b.height)<1,'same-row inputs aligned');
 await page.locator('input[name=name]').fill('浏览器发布验证');await page.locator('textarea[name=summary]').fill('验证用户能够按发布流程完整保存资源');check(await page.locator('textarea[name=implementation]').count()===0,'create form omits implementation field');await page.locator('textarea[name=installationCommand]').fill('测试安装指令');await page.locator('textarea[name=usageExample]').fill('供应商 + 渠道 + 日期');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:new URL('publish-form.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
 check(await page.locator('input[name=slug],input[name=tags]').count()===0,'removed resource identifier and search tags');await page.locator('input[name=version]').fill('');await page.getByRole('button',{name:'保存资源',exact:true}).click();check(await page.locator('input[name=version]').evaluate(e=>e.validity.valueMissing),'browser requires version');await page.locator('input[name=version]').fill('1.2.3');
 const response=page.waitForResponse(r=>r.url()===origin+'/api/resources'&&r.request().method()==='POST');await page.getByRole('button',{name:'保存资源',exact:true}).click();const saved=await response;check(saved.status()===201,'browser publishes other category');resources.push((await saved.json()).id);const listing=await (await context.request.get(origin+'/api/resources')).json();check(listing.resources.find(r=>r.id===resources.at(-1)).version==='1.2.3','required version persisted');
 await page.locator('.resource-editor-page').waitFor({state:'detached'});
 const fixtureId=resources.at(-1);check((await context.request.put(origin+'/api/resources/'+fixtureId,{data:{tags:['保留已有分类词']}})).status()===200,'fixture tags set');
 await page.locator('.sidebar').getByRole('button',{name:'我创建的',exact:true}).click();await page.locator('.resource-card').filter({hasText:'浏览器发布验证'}).click();await page.getByRole('button',{name:'编辑资源',exact:true}).click();
 const update=page.waitForResponse(r=>r.url()===origin+'/api/resources/'+fixtureId&&r.request().method()==='PUT');await page.getByRole('button',{name:'保存修改',exact:true}).click();check((await update).status()===200,'edit without identifier or tag controls saves');
 await page.locator('.resource-editor-page').waitFor({state:'detached'});const afterEdit=await (await context.request.get(origin+'/api/resources')).json();const edited=afterEdit.resources.find(r=>r.id===fixtureId);check(edited.tags.includes('保留已有分类词')&&edited.slug===listing.resources.find(r=>r.id===fixtureId).slug,'removed fields do not erase existing metadata');
 // Every tab, including Resource Center, can be closed; closing the last one is safe.
 while(await page.locator('.workspace-tab-close').count()){await page.locator('.workspace-tab-close').first().click();}
 check(await page.locator('.workspace-tab').count()===0,'all tabs closable');check(await page.locator('.catalog-toolbar').isVisible(),'safe last-tab fallback');
 await page.getByRole('button',{name:'返回资源中心',exact:true}).click();check(await page.locator('.workspace-tab').count()===1,'resource center can reopen');
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');
 await page.screenshot({path:new URL('mobile.png',out).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
 await context.close();check(errors.length===0,'no browser runtime errors: '+errors.join(';'));
 console.log(JSON.stringify({checks,errors,screenshots:out.href}));
} finally {
 await browser.close();
 for(const id of websites){db.prepare('DELETE FROM team_websites WHERE id=?').run(id);db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(id);}
 for(const id of resources){db.prepare('DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?').run(id,id);db.prepare('DELETE FROM resources WHERE id=?').run(id);db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(id);}
 for(const id of ids)db.prepare('DELETE FROM sessions WHERE id=?').run(id);
 if(loginFixtureId){db.prepare("DELETE FROM sessions WHERE user_id=?").run(loginFixtureId);db.prepare("DELETE FROM audit_logs WHERE actor_id=?").run(loginFixtureId);db.prepare("DELETE FROM users WHERE id=?").run(loginFixtureId);}
 db.close();
}
