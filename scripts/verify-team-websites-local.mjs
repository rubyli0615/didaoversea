// Local preview only. Creates short-lived test sessions; never contacts production.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const origin = "http://127.0.0.1:5173";
const directory = fileURLToPath(new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/", import.meta.url));
const filename = readdirSync(directory).find((name) => /^[a-f0-9]+\.sqlite$/.test(name));
assert(filename, "Start and migrate the local preview database first");
const db = new DatabaseSync(path.join(directory, filename));
db.exec("PRAGMA busy_timeout = 10000");
const createdSessions = [];
const createdSites = [];
let checks = 0;
function session(userId) {
  const token = randomBytes(32).toString("hex");
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").run(id, userId, createHash("sha256").update(token).digest("hex"), now + 300, now);
  createdSessions.push(id);
  return token;
}
async function call(token, route, method = "GET", body) {
  if (body && route.startsWith("/api/team-websites")) body = { description: "本地验证：查询团队业务数据", ...body };
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Cookie: `dida_ai_session=${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (method === "POST" && response.status === 201) createdSites.push(data.id);
  return { status: response.status, data };
}
const expect = (result, status) => { assert.equal(result.status, status, JSON.stringify(result.data)); checks++; return result.data; };
try {
  expect(await call(null, "/api/team-websites"), 401);
  const admin = session("usr-ruby");
  const ordinary = session("usr-kristine");
  const creator = session("usr-lea");
  expect(await call(ordinary, "/api/team-websites"), 200);
  expect(await call(ordinary, "/api/team-websites", "POST", { teamId: "ai-project", name: "test", url: "https://example.com" }), 403);
  expect(await call(creator, "/api/team-websites", "POST", { teamId: "data", name: "test", url: "https://example.com" }), 201);
  expect(await call(creator, "/api/resources", "POST", { type: "INTERNAL", scenario: "other_useful" }), 400);
  const teams = [["usr-jason-huang", "ai-project"], ["usr-lumino", "data"], ["usr-william", "apac-me"], ["usr-jeffee", "europe-americas"], ["usr-kelly", "agoda"], ["usr-banks", "onboarding"]];
  const concurrentUrl = `https://example.com/local-test/${randomUUID()}`;
  const concurrent = await Promise.all([1, 2].map(() => call(admin, "/api/team-websites", "POST", { teamId: "data", name: "Concurrent check", url: concurrentUrl })));
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [201, 409]); checks++;
  for (const [userId, teamId] of teams) {
    const token = session(userId);
    const url = `https://example.com/local-test/${randomUUID()}`;
    const { id } = expect(await call(token, "/api/team-websites", "POST", { teamId, name: "Local verification", url }), 201);
    expect(await call(token, "/api/team-websites", "POST", { teamId, name: "Duplicate", url }), 409);
    for (const [, otherId] of teams.filter(([, otherId]) => otherId !== teamId)) expect(await call(token, "/api/team-websites", "POST", { teamId: otherId, name: "Cross-team", url }), ["usr-lumino","usr-jason-huang"].includes(userId) ? 201 : 403);
    expect(await call(ordinary, `/api/team-websites/${id}`, "PUT", { name: "Forbidden", url }), 403);
    expect(await call(creator, `/api/team-websites/${id}`, "DELETE"), 403);
    expect(await call(token, `/api/team-websites/${id}`, "PUT", { teamId: "invalid", name: "Move", url }), 400);
    expect(await call(token, `/api/team-websites/${id}`, "PUT", { name: "Invalid URL", url: "javascript:alert(1)" }), 400);
    expect(await call(token, `/api/team-websites/${id}`, "PUT", { name: "Updated name", url }), 200);
    const listing = expect(await call(ordinary, "/api/team-websites"), 200);
    assert.equal(listing.websites.find((site) => site.id === id)?.name, "Updated name"); checks++;
    expect(await call(admin, `/api/team-websites/${id}`, "PUT", { name: "Admin edit", url }), 200);
    if (!["usr-lumino", "usr-jason-huang"].includes(userId)) {
      const info = expect(await call(token, "/api/auth/session"), 200);
      assert.equal(info.user.role, "VIEWER"); checks++;
      expect(await call(token, "/api/resources", "POST", { type: "SKILL" }), 403);
    }
    expect(await call(teamId === "agoda" ? admin : token, `/api/team-websites/${id}`, "DELETE"), 200);
    expect(await call(token, `/api/team-websites/${id}`, "PUT", { name: "Deleted", url }), 404);
  }
  console.log(`Local team website API integration: ${checks} checks passed.`);
} finally {
  for (const id of createdSites) {
    db.prepare("DELETE FROM team_websites WHERE id = ?").run(id);
    db.prepare("DELETE FROM audit_logs WHERE target_id = ?").run(id);
  }
  for (const id of createdSessions) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  db.close();
}
