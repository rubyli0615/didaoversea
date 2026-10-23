import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const origin = "http://127.0.0.1:5173";
import { importSource } from "./ts-module-loader.mjs";
const moduleFrom = (relative) => importSource(relative, import.meta.url);
const content = await moduleFrom("../lib/resource-content.ts");
const mcp = await moduleFrom("../lib/mcp-content.ts");
const { ResourceDetail } = await moduleFrom("../components/resource-detail.tsx");
const { isTeamWebsiteLead } = await moduleFrom("../lib/team-websites.ts");
const directory = fileURLToPath(new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/", import.meta.url));
const filename = readdirSync(directory).find((name) => /^[a-f0-9]+\.sqlite$/.test(name));
assert(filename);
const db = new DatabaseSync(path.join(directory, filename));
const sessionIds = [], resourceIds = [];
let checks = 0;
function check(condition, message) { assert(condition, message); checks++; }
function session(userId) { const id = randomUUID(), token = randomBytes(32).toString("hex"), now = Math.floor(Date.now() / 1000); db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(id, userId, createHash("sha256").update(token).digest("hex"), now + 600, now); sessionIds.push(id); return token; }
async function call(token, route, method = "GET", body) {
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", Cookie: `dida_ai_session=${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (method === "POST" && response.status === 201) resourceIds.push(data.id);
  return { status: response.status, data };
}
function expect(result, status) { assert.equal(result.status, status, JSON.stringify(result.data)); checks++; return result.data; }
const noOp = () => {};
try {
  const admin = session("usr-ruby"), creator = session("usr-lumino"), leadViewer = session("usr-william");
  const listing = expect(await call(admin, "/api/resources"), 200);
  const tiger = listing.resources.find((r) => r.slug === "tiger-mcp");
  const dataMcp = listing.resources.find((r) => r.slug === "data-mcp");
  check(tiger.installationCommand === mcp.TIGER_MCP_INSTALL, "Tiger instructions verbatim");
  check(dataMcp.installationCommand === mcp.DATA_MCP_INSTALL, "Data JSON verbatim");
  check(JSON.stringify(tiger.toolList) === JSON.stringify(mcp.TIGER_MCP_TOOLS), "Tiger discovered tool IDs");
  check(JSON.stringify(dataMcp.toolList) === JSON.stringify(mcp.DATA_MCP_TOOLS), "Data discovered tool IDs");
  check(tiger.accessData.includes("未提供底层数据表名称") && dataMcp.accessData.includes("37 张候选"), "MCP data is evidence scoped, not claimed permissions");
  check(tiger.usageExample === "为我查询渠道订单号为xxxx的操作日志。" && dataMcp.usageExample === "查询过去 7 天的 GP 指标，按天分组。", "Provided usage examples");
  check(dataMcp.documentationUrl === "https://didatravel.feishu.cn/docx/QZ7wdlt0joYPuExZZovcxUNknxf", "Data usage document");
  const attribution = listing.resources.find((r) => r.slug === "attribution-analysis");
  const supplier = listing.resources.find((r) => r.slug === "supplier-analysis");
  const l2l = listing.resources.find((r) => r.slug === "l2l-downgrade");
  const scheduled = listing.resources.find((r) => r.slug === "overseas-api-drop-mvp");
  check(attribution.installationCommand === content.ATTRIBUTION_INSTALL, "Attribution command must remain verbatim");
  check(supplier.installationCommand === content.SUPPLIER_INSTALL, "Supplier command must remain verbatim");
  check(l2l.installationCommand === content.L2L_INSTALL, "Windows installation steps preserved");
  check(attribution.dataPermissions.length === 20, "All 20 attribution data permissions");
  check(l2l.dataPermissions.length === 13, "All 13 L2L data permissions");
  check(l2l.dataPermissions.some((row) => row.table === "data_ovs.brg_log" && row.priority.includes("重点")), "BRG permission emphasized");
  check(!listing.resources.some((r) => r.slug === "dida-mcp"), "dida-mcp archived");
  check(listing.resources.filter((r) => r.type === "SKILL").every((r) => r.version === "1.0.0"), "Existing skill versions");
  check(scheduled.installationMode === "none", "Scheduled skill requires no personal installation");
  const user = { id: "usr-ruby", email: "ruby.li@dida.com", role: "ADMIN", displayName: "Ruby", active: true };
  const render = (resource) => renderToStaticMarkup(React.createElement(ResourceDetail, { resource, resources: listing.resources, relations: listing.relations, user, onSelect: noOp, onEdit: noOp, onDeleted: noOp }));
  const html = render(attribution);
  for (const title of ["安装前准备", "安装指令", "如何使用", "资源介绍", "Skill 关联"]) check(html.includes(`<h2>${title}</h2>`), `Continuous section ${title}`);
  check(!html.includes("resource-page-tabs") && !html.includes("返回资源中心"), "No detail tab switching or duplicate back link");
  check(html.includes("WdblwCtSDiRWrckxxr7c2AYnnVg"), "Provided case link");
  check(render(scheduled).includes("无需个人安装 · 团队统一运行"), "No-install status visible without sidebar action");
  check(!render(scheduled).includes("暂无使用文档"), "No redundant missing document button");
  check(html.includes('aria-label="复制安装指令"'), "Installation toolbar copy action enabled");
  check(!isTeamWebsiteLead(user, "ai-project"), "Admin who is not group leader has no add button");
  check(isTeamWebsiteLead({ email: "william.xia@dida.com", active: true }, "apac-me"), "Own group add button");
  check(!isTeamWebsiteLead({ email: "william.xia@dida.com", active: true }, "data"), "No cross-group add button");
  const body = { version: "1.0.0", type: "SKILL", name: "Local resource verification", summary: "痛点与解决的问题", implementation: "只读分析并生成 HTML 案例", contact: "Test contact", usageExample: "供应商 + 渠道 + 日期", businessDirection: "technical_operations", installationMode: "none", installationCommand: "", slug: `local-test-${randomUUID()}`, caseUrl: "https://example.com/report.html", dataPermissions: [{ priority: "P0", table: "public.example", purpose: "只读分析" }] };
  expect(await call(leadViewer, "/api/resources", "POST", body), 403);
  expect(await call(creator, "/api/resources", "POST", { ...body, version: "" }), 400);
  expect(await call(creator, "/api/resources", "POST", { ...body, version: " " }), 400);
  expect(await call(creator, "/api/resources", "POST", { ...body, contact: "" }), 400);
  const { implementation: omittedImplementation, ...withoutImplementation } = body;
  const optionalId = expect(await call(creator, "/api/resources", "POST", { ...withoutImplementation, slug: `local-test-${randomUUID()}` }), 201).id;
  check(expect(await call(creator, "/api/resources"), 200).resources.find((r) => r.id === optionalId).implementation === null, "Create succeeds without implementation");
  expect(await call(creator, "/api/resources", "POST", { ...body, caseUrl: "javascript:alert(1)" }), 400);
  expect(await call(creator, "/api/resources", "POST", { ...body, installationMode: "required" }), 400);
  expect(await call(creator, "/api/resources", "POST", { ...body, repositoryAccess: "private", repositoryInstructions: "" }), 400);
  const { id } = expect(await call(creator, "/api/resources", "POST", body), 201);
  const find = async () => expect(await call(creator, "/api/resources"), 200).resources.find((r) => r.id === id);
  expect(await call(creator, `/api/resources/${id}`, "PUT", { version: "" }), 400);
  const saved = await find();
  check(saved.implementation === body.implementation && saved.contact === body.contact && saved.caseUrl === body.caseUrl && saved.dataPermissions.length === 1, "Publishing fields persisted");
  expect(await call(creator, `/api/resources/${id}`, "PUT", { summary: "Updated summary without implementation field" }), 200);
  check((await find()).implementation === body.implementation, "Existing implementation preserved when omitted during edit");
  check(saved.version === "1.0.0" && saved.installationCommand === null, "No-install resource can be saved without fake instructions");
  expect(await call(leadViewer, `/api/resources/${id}`, "PUT", { detail: "forbidden" }), 403);
  expect(await call(creator, `/api/resources/${id}`, "PUT", { installationMode: "required", installationCommand: "Exact\n$HOME/test", repositoryAccess: "private", repositoryInstructions: "Ask contact for GitHub access", previousSkillId: "skill-supplier", previousCondition: "先查供应商", nextSkillId: "skill-l2l", nextCondition: "配置变更时" }), 200);
  check((await find()).installationCommand === "Exact\n$HOME/test", "Instructions preserved through edit and bootstrap");
  const relationLinks = [{ direction: "before", targetId: "skill-supplier", condition: "前置" }, { direction: "after", targetId: "skill-l2l", condition: "后续" }, { direction: "after", targetId: "skill-attribution", condition: "继续归因" }];
  expect(await call(creator, `/api/resources/${id}`, "PUT", { relationLinks }), 200);
  check(expect(await call(creator, "/api/resources"), 200).relations.filter((r) => r.sourceSkillId === id || r.targetSkillId === id).length === 3, "All multiple relations preserved");
  expect(await call(creator, `/api/resources/${id}`, "PUT", { relationLinks: [{ direction: "after", targetId: id, condition: "Self" }] }), 400);
  expect(await call(creator, `/api/resources/${id}`, "PUT", { relationLinks: [] }), 200);
  expect(await call(creator, `/api/resources/${id}`, "PUT", { previousSkillId: id }), 400);
  expect(await call(creator, `/api/resources/${id}`, "PUT", { installationMode: "pending", installationCommand: "", previousSkillId: "", nextSkillId: "" }), 200);
  const refreshed = await find();
  check(refreshed.installationCommand === null && refreshed.installationMode === "pending", "Instructions can be cleared and stay cleared");
  check(!expect(await call(admin, "/api/resources"), 200).relations.some((r) => r.sourceSkillId === id || r.targetSkillId === id), "Relations can be removed");
  console.log(`Resource experience: ${checks} API, content and rendered-behavior checks passed.`);
} finally {
  for (const id of resourceIds) { db.prepare("DELETE FROM skill_relations WHERE source_skill_id = ? OR target_skill_id = ?").run(id, id); db.prepare("DELETE FROM resources WHERE id = ?").run(id); db.prepare("DELETE FROM audit_logs WHERE target_id = ?").run(id); }
  for (const id of sessionIds) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  db.close();
}
