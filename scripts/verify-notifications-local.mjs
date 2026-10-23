// Uses local-only fixture accounts and resources. Never contacts production.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdirSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const origin = "http://127.0.0.1:5173";
const directory = new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/", import.meta.url);
const db = new DatabaseSync(new URL(readdirSync(directory).find((name) => /^[a-f0-9]+\.sqlite$/.test(name)), directory));
const fixtures = [], sessionIds = [], resourceIds = [], browserErrors = [];
const output = new URL("../outputs/browser-qa/", import.meta.url); mkdirSync(output, { recursive: true });
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const expect = (response, status) => { assert.equal(response.status, status, JSON.stringify(response.data)); checks++; return response.data; };
function account(role) {
  const id = "notification-qa-" + randomUUID(), now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO users (id,email,display_name,role,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, id + "@dida.com", "Notification QA", role, 1, now, now);
  fixtures.push(id); return id;
}
function session(id) {
  const token = randomBytes(32).toString("hex"), sid = randomUUID(), now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(sid, id, createHash("sha256").update(token).digest("hex"), now + 1200, now);
  sessionIds.push(sid); return token;
}
async function api(token, route, method = "GET", body) {
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Cookie: "dida_ai_session=" + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const raw = await response.text(); assert(raw, "Empty response: "+method+" "+route+" status="+response.status);
  const data = JSON.parse(raw);
  if (method === "POST" && route === "/api/resources" && response.status === 201) resourceIds.push(data.id);
  return { status: response.status, data };
}
const listing = async (token) => expect(await api(token, "/api/resources?refresh=1"), 200).resources;
const find = async (token, id) => (await listing(token)).find((item) => item.id === id);
const body = (type, name) => ({ type, name, slug: "notice-" + randomUUID(), version: "1.0.0", summary: "通知验证", documentationUrl:"https://example.com/manual", accessMethod: "Streamable HTTP", detail: "适用说明", implementation: "本地测试", usageExample: "使用示例", contact: "QA", businessDirection: "other", installationMode: "none", sourceUrl: "https://example.com/resource", releaseNote: "首版发布" });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const adminId = account("ADMIN"), aId = account("VIEWER"), bId = account("VIEWER");
  const admin = session(adminId), a = session(aId), b = session(bId), creator = session("usr-lumino");
  // Public initialization is normally performed on the first authenticated page request.
  expect(await api(admin, "/api/resources"), 200);
  expect(await api(null, "/api/notifications/read", "POST", { items: [] }), 401);
  expect(await api(a, "/api/notifications/read", "POST", { items: [] }), 400);
  expect(await api(a, "/api/notifications/read", "POST", { items: [{ resourceId: "x", revision: 0 }] }), 400);
  for (const type of ["SKILL", "MCP", "AGENT"]) {
    const { id } = expect(await api(admin, "/api/resources", "POST", body(type, type + " publication QA")), 201);
    let row = await find(a, id);
    check(row.updateNotice?.kind === "new" && row.updateNotice.revision === 1, type + " new publication notice");
    expect(await api(a, "/api/notifications/read", "POST", { userId: bId, items: [{ resourceId: id, revision: 1 }] }), 200);
    check(!(await find(a, id)).updateNotice && (await find(b, id)).updateNotice?.revision === 1, "read state isolated per account, ignores forged userId");
    check(!(await find(session(aId), id)).updateNotice, "read state survives a new session");
    expect(await api(admin, "/api/resources/" + id, "PUT", { summary: "实质更新", releaseNote: "新增能力" }), 200);
    row = await find(a, id);check(row.updateNotice?.kind === "updated" && row.updateNotice.revision === 2, type + " update notice");
    expect(await api(a, "/api/notifications/read", "POST", { items: [{ resourceId: id, revision: 1 }] }), 200);
    check((await find(a, id)).updateNotice?.revision === 2, "late acknowledgement cannot hide newer update");
    expect(await api(a, "/api/notifications/read", "POST", { items: [{ resourceId: id, revision: 99 }] }), 400);
    expect(await api(admin, "/api/resources/" + id, "PUT", { summary: "实质更新", releaseNote: "新增能力" }), 200);
    check((await find(a, id)).updateNotice?.revision === 2, "no-op save does not generate another notice");
    expect(await api(a, "/api/notifications/read", "POST", { items: [{ resourceId: id, revision: 2 }] }), 200);
    expect(await api(a, "/api/notifications/read", "POST", { items: [{ resourceId: id, revision: 1 }] }), 200);
    check(!(await find(a, id)).updateNotice, "older acknowledgements cannot regress read revision");
    expect(await api(admin, "/api/resources/" + id, "DELETE"), 200);
    check(!(await find(b, id)), "archived updates disappear");
    expect(await api(b, "/api/notifications/read", "POST", { items: [{ resourceId: id, revision: 2 }] }), 404);
  }
  const draftId = expect(await api(creator, "/api/resources", "POST", body("SKILL", "Draft publication QA")), 201).id;
  check(!(await find(a, draftId)) && !(await find(creator, draftId)).updateNotice, "draft is private and sends no notice");
  expect(await api(creator, "/api/resources/" + draftId, "PUT", { status: "PUBLISHED" }), 200);
  check((await find(creator, draftId)).status === "DRAFT", "creator cannot self-approve a draft");
  expect(await api(admin, "/api/resources/" + draftId, "PUT", { status: "PUBLISHED" }), 200);
  check((await find(a, draftId)).updateNotice?.kind === "new", "admin publication sends first notice");
  const internalId = expect(await api(admin, "/api/resources", "POST", { ...body("INTERNAL", "Website no-notice QA"), scenario: "overseas_op", websiteCategoryId: "op-data" }), 201).id;
  check(!(await find(a, internalId)).updateNotice, "website changes are outside notification scope");
  expect(await api(a, "/api/notifications/read", "POST", { items: [{ resourceId: internalId, revision: 1 }] }), 404);

  const skillId = expect(await api(admin, "/api/resources", "POST", body("SKILL", "红点交互验证 Skill")), 201).id;
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await adminContext.addCookies([{ name: "dida_ai_session", value: admin, url: origin, httpOnly: true, sameSite: "Lax" }]);
  const adminPage = await adminContext.newPage();
  await adminPage.goto(origin);await adminPage.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" }).waitFor();
  await adminPage.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" }).click();await adminPage.getByRole("button", { name: "编辑资源", exact: true }).click();
  const noOpSave = adminPage.waitForResponse((r) => r.url() === origin + "/api/resources/" + skillId && r.request().method() === "PUT");
  await adminPage.getByRole("button", { name: "保存修改", exact: true }).click();check((await noOpSave).status() === 200 && (await find(a, skillId)).updateNotice?.revision === 1, "unchanged full publishing form does not generate another update");
  const approvalId = expect(await api(creator, "/api/resources", "POST", body("SKILL", "待发布提醒验证")), 201).id;
  await adminPage.locator(".brand-home").click();await adminPage.reload();await adminPage.locator(".resource-card").filter({ hasText: "待发布提醒验证" }).click();
  await adminPage.getByRole("button", { name: "编辑资源", exact: true }).click();
  const approval = adminPage.waitForResponse((r) => r.url() === origin + "/api/resources/" + approvalId && r.request().method() === "PUT");
  await adminPage.getByRole("button", { name: "发布并通知团队", exact: true }).click();check((await approval).status() === 200 && (await find(a, approvalId)).updateNotice?.kind === "new", "admin publishing control emits first team notification");
  await adminContext.close();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "dida_ai_session", value: a, url: origin, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(origin);
  let card = page.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" });
  await card.getByLabel("未读新增资源", { exact: true }).waitFor();
  check(await page.locator(".notification-count").isVisible(), "bell unread count visible");
  await page.locator(".notification-center>summary").click();await page.locator(".notification-panel").waitFor({ state: "visible" });
  check(await page.locator(".notification-item").filter({ hasText: "红点交互验证 Skill" }).count() === 1, "new resource listed in notification center");
  await page.screenshot({ path: new URL("notifications-new.png", output).pathname.replace(/^\/(.:)/, "$1"), fullPage: true });
  await page.locator(".notification-item").filter({ hasText: "红点交互验证 Skill" }).click();await page.getByRole("heading", { name: "红点交互验证 Skill", exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector(".notification-panel")?.textContent.includes("红点交互验证 Skill"));
  check(!(await find(a, skillId)).updateNotice, "opening notification marks observed resource as read");
  await page.locator(".sidebar").getByRole("button", { name: "Skills", exact: true }).click();
  check(await page.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" }).locator(".resource-update-badge").count() === 0, "card red dot cleared after opening");
  expect(await api(admin, "/api/resources/" + skillId, "PUT", { summary: "更新后的能力说明", version: "1.1.0", releaseNote: "增加一个新分析能力" }), 200);
  // Focus is a supported refresh trigger; no manual page reload is needed.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" }).getByLabel("未读资源更新", { exact: true }).waitFor();
  check((await find(b, skillId)).updateNotice?.revision === 2, "another account independently retains unread update");
  let releaseSnapshot, snapshotStarted;
  const snapshotGate = new Promise((resolve) => { releaseSnapshot = resolve; });
  const snapshotReady = new Promise((resolve) => { snapshotStarted = resolve; });
  await page.route("**/api/resources?refresh=1*", async (route) => { const response = await route.fetch();snapshotStarted();await snapshotGate;await route.fulfill({ response }); }, { times: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));await snapshotReady;
  await page.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" }).click();await page.getByRole("heading", { name: "红点交互验证 Skill", exact: true }).waitFor();
  for (let attempt = 0; attempt < 20 && (await find(a, skillId)).updateNotice; attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
  check(!(await find(a, skillId)).updateNotice, "opening current revision acknowledges it");
  releaseSnapshot();await page.waitForResponse((r) => r.url().includes("/api/resources?refresh=1"));
  await page.locator(".sidebar").getByRole("button", { name: "Skills", exact: true }).click();
  check(await page.locator(".resource-card").filter({ hasText: "红点交互验证 Skill" }).locator(".resource-update-badge").count() === 0, "late refresh cannot resurrect an acknowledged badge");
  const agent = page.locator(".sidebar").getByRole("button", { name: "Agent", exact: true }), website = page.locator(".sidebar").getByRole("button", { name: "网站", exact: true });
  const style = async (locator) => locator.evaluate((e) => { const s = getComputedStyle(e); return [s.padding, s.minHeight, s.fontSize, s.fontWeight, s.lineHeight, s.textDecorationLine, e.parentElement.className]; });
  check(JSON.stringify(await style(agent)) === JSON.stringify(await style(website)), "Agent and Websites use identical sibling disclosure styles");
  await page.locator(".notification-center>summary").click();await page.getByRole("button", { name: "全部已读", exact: true }).click();
  await page.getByText("暂无未读更新", { exact: true }).waitFor();
  check(await page.locator(".notification-count").count() === 0 && await page.locator(".resource-update-badge").count() === 0, "mark all clears bell and card badges");
  await page.reload();await page.getByRole("button", { name: "Skills", exact: true }).waitFor();
  check(await page.locator(".notification-count").count() === 0, "read state persists after browser reload");
  await page.setViewportSize({ width: 390, height: 844 });await page.locator(".notification-center>summary").click();
  const bounds = await page.locator(".notification-panel").boundingBox();check(bounds.x >= 0 && bounds.x + bounds.width <= 390, "notification panel fits mobile viewport");
  await context.close();check(browserErrors.length === 0, "no browser runtime errors: " + browserErrors.join(";"));
  console.log(JSON.stringify({ notificationChecks: checks, browserErrors }));
} finally {
  await browser.close();
  for (const id of resourceIds) { db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(id);db.prepare("DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?").run(id, id);db.prepare("DELETE FROM resources WHERE id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id); }
  for (const id of sessionIds) db.prepare("DELETE FROM sessions WHERE id=?").run(id);
  for (const id of fixtures) { db.prepare("DELETE FROM resource_reads WHERE user_id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE actor_id=?").run(id);db.prepare("DELETE FROM users WHERE id=?").run(id); }
  db.close();
}
