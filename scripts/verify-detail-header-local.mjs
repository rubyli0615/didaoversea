import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const origin = 'http://127.0.0.1:5173';
const dir = new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/', import.meta.url);
const db = new DatabaseSync(new URL(readdirSync(dir).find(n => /^[a-f0-9]+\.sqlite$/.test(n)), dir));
db.exec('PRAGMA busy_timeout = 10000');
const id = randomUUID(), token = randomBytes(32).toString('hex'), now = Math.floor(Date.now()/1000);
db.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').run(id,'usr-lumino',createHash('sha256').update(token).digest('hex'),now+600,now);
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const context = await browser.newContext({viewport:{width:1680,height:1000}});
  await context.addCookies([{name:'dida_ai_session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
  const page = await context.newPage(); await page.goto(origin);
  await page.locator('.resource-card').filter({hasText:'log-order-skill'}).click();
  await page.locator('.resource-page-hero').waitFor();
  for(const width of [1680,900,390]) {
    await page.setViewportSize({width,height:900});
    await page.locator('.resource-page-hero').screenshot({path:`outputs/browser-qa/detail-header-${width}.png`});
    const state = await page.evaluate(() => {
      const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right};};
      const hero = document.querySelector('.resource-page-hero');
      return {width:innerWidth,doc:document.documentElement.scrollWidth,icon:rect(hero.querySelector('.resource-icon')),title:rect(hero.querySelector('h1')),badges:rect(hero.querySelector('.detail-badges')),summary:rect(hero.querySelector('p')),layout:[...document.querySelectorAll('.resource-page-layout,.resource-page-layout>main,.resource-content-card,.permission-table-scroll')].map(e=>({cls:e.className,...rect(e)}))};
    });
    assert(state.doc<=width, 'detail does not overflow at '+width);
    assert(Math.abs(state.icon.y+state.icon.h/2-state.title.y-state.title.h/2)<1);
    assert(state.summary.y>=Math.max(state.icon.b,state.title.b));
    assert(state.title.right<=width && state.summary.right<=width);
  }
  await page.locator('.resource-page-hero h1').evaluate(el => el.textContent='较长资源名称验证：酒店订单异常分析与跨系统日志核验工作流程 Skill');
  const longTitle = await page.locator('.resource-page-hero').evaluate(el => {const i=el.querySelector('.resource-icon').getBoundingClientRect(),t=el.querySelector('h1').getBoundingClientRect();return {offset:Math.abs(i.y+i.height/2-t.y-t.height/2),height:t.height,right:t.right};});
  assert(longTitle.offset<1 && longTitle.height>44 && longTitle.right<=390, 'wrapped titles stay aligned with icon');
  await page.screenshot({path:'outputs/browser-qa/detail-mobile.png',fullPage:true});
  console.log('Detail header: desktop, tablet, mobile and multiline title checks passed.');
} finally {await browser.close();db.prepare('DELETE FROM sessions WHERE id=?').run(id);db.close();}
