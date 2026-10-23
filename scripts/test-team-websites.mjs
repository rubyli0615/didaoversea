import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/team-websites.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { WEBSITE_TEAMS, canManageTeamWebsites, validateWebsiteInput } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const actor = (email, role = "VIEWER", active = true) => ({ email, role, active });
let checks = 0;
function check(actual, expected) { assert.equal(actual, expected); checks++; }
check(WEBSITE_TEAMS.length, 6);
for (const team of WEBSITE_TEAMS) {
  check(canManageTeamWebsites(actor(team.leadEmail), team.id), true);
  check(canManageTeamWebsites(actor(team.leadEmail.toUpperCase()), team.id), true);
  check(canManageTeamWebsites(actor(team.leadEmail, "VIEWER", false), team.id), false);
  check(canManageTeamWebsites(actor("ruby.li@dida.com", "ADMIN"), team.id), true);
  for (const other of WEBSITE_TEAMS.filter((candidate) => candidate.id !== team.id)) {
    check(canManageTeamWebsites(actor(team.leadEmail), other.id), false);
  }
  for (const email of ["kristine.liu@dida.com", "lea.wang@dida.com", "terrence.yang@dida.com", "max.long@dida.com"]) {
    check(canManageTeamWebsites(actor(email, "CREATOR"), team.id), false);
  }
}
check(canManageTeamWebsites(actor("ruby.li@dida.com", "ADMIN"), "not-a-team"), false);
check(validateWebsiteInput({ description: "网站功能", name: " 工作台 ", url: " https://example.com " }).url, "https://example.com/");
check(validateWebsiteInput({ description: "网站功能", name: " 工作台 ", url: "https://example.com" }).name, "工作台");
for (const url of ["javascript:alert(1)", "data:text/html,hello", "ftp://example.com", "https://user:password@example.com", "example.com", "", null, 42]) {
  check(Boolean(validateWebsiteInput({ description: "网站功能", name: "网站", url }).error), true);
}
for (const name of ["", " ", "x".repeat(101), 42, null]) check(Boolean(validateWebsiteInput({ description: "网站功能", name, url: "https://example.com" }).error), true);
for (const description of [undefined, "", " ", "x".repeat(501), 42]) check(Boolean(validateWebsiteInput({ name: "网站", url: "https://example.com", description }).error), true);
console.log(`Team website policy and input validation: ${checks} checks passed.`);
