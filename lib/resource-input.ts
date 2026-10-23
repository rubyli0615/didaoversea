import { isUsageGuide } from "./resource-usage";
import { SKILL_CATEGORIES, type CommonQa, type DataPermission } from "./resource-types";

export function parsePermissions(value: unknown): DataPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is DataPermission => Boolean(row && typeof row === "object" && typeof row.table === "string" && typeof row.priority === "string" && typeof row.purpose === "string"));
}

export function validateResourceContent(body: Record<string, unknown>, type: string, creating: boolean) {
  if (body.resourceModule !== undefined && !["dida", "overseas", "other"].includes(String(body.resourceModule))) return "请选择有效的所属模块";
  if (body.commonQa !== undefined && (!Array.isArray(body.commonQa) || body.commonQa.length > 30 || body.commonQa.some(row => !row || typeof row !== "object" || typeof row.question !== "string" || !row.question.trim() || row.question.length > 300 || typeof row.answer !== "string" || !row.answer.trim() || row.answer.length > 8000))) return "请填写完整的 Q&A 问题与回答（最多 30 项）";
  if (type !== "INTERNAL" && type !== "OTHER" && (creating || body.version !== undefined) && (typeof body.version !== "string" || !body.version.trim() || body.version.trim().length > 50)) return "请填写版本，最多 50 个字符";
  if (type === "OTHER") {
    if (body.resourceModule !== undefined && body.resourceModule !== "other") return "其他资源仅可归入“其他”模块";
    for (const field of ["scenario", "name", "sourceUrl", "detail"]) if ((creating || body[field] !== undefined) && (typeof body[field] !== "string" || !String(body[field]).trim())) return "请填写类别、名称、链接和使用说明";
    if (String(body.scenario ?? "").length > 40 || String(body.name ?? "").length > 150 || String(body.detail ?? "").length > 20000) return "类别最多 40 字、名称最多 150 字、使用说明最多 20000 字";
  }
  if (type === "INTERNAL") {
    if (creating && (typeof body.websiteCategoryId !== "string" || !body.websiteCategoryId)) return "请选择网站分类";
    if (body.websiteCategoryId !== undefined && body.websiteCategoryId !== null && (typeof body.websiteCategoryId !== "string" || body.websiteCategoryId.length > 100)) return "请选择有效的网站分类";
    if ((creating || body.name !== undefined) && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100)) return "请输入网站名称，最多 100 个字符";
    if ((creating || body.summary !== undefined) && (typeof body.summary !== "string" || !body.summary.trim() || body.summary.trim().length > 500)) return "请输入网站功能说明，最多 500 个字符";
    if ((creating || body.scenario !== undefined) && !["overseas_op", "ai_tools"].includes(String(body.scenario))) return "请在海外 OP 或 AI 常用网站页面添加网站";
    if ((creating || body.sourceUrl !== undefined) && (typeof body.sourceUrl !== "string" || !body.sourceUrl.trim() || body.sourceUrl.length > 2048)) return "请输入完整的网站网址";
  }
  if (body.tablePermissionReason !== undefined && (typeof body.tablePermissionReason !== "string" || body.tablePermissionReason.length > 4000)) return "表权限申请原因最多 4000 字";
  const textFields = ["name", "summary", "implementation", "contact", "usageExample", "usageInstructions", "installationCommand", "repositoryInstructions", "mcpRequirements", "detail", "accessData", "accessMethod", "knowledgeScope"];
  for (const field of textFields) if (body[field] !== undefined && (typeof body[field] !== "string" || String(body[field]).length > 50000)) return "内容格式不正确或超出长度限制";
  for (const field of ["sourceUrl", "caseUrl", "documentationUrl", "referenceUrl"]) {
    if (!body[field]) continue;
    try { const url = new URL(String(body[field])); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "链接必须是完整的 HTTP(S) 网址"; } catch { return "链接必须是完整的 HTTP(S) 网址"; }
  }
  if (body.installationMode !== undefined && !["required", "none", "pending"].includes(String(body.installationMode))) return "请选择有效的安装方式";
  if (body.repositoryAccess !== undefined && !["none", "public", "private"].includes(String(body.repositoryAccess))) return "请选择有效的仓库权限";
  if (body.dataPermissions !== undefined && (!Array.isArray(body.dataPermissions) || body.dataPermissions.length > 100 || parsePermissions(body.dataPermissions).length !== body.dataPermissions.length || parsePermissions(body.dataPermissions).some(row => row.table.length > 300 || row.priority.length > 50 || row.purpose.length > 2000))) return "请检查数据权限清单";
  if (body.relationLinks !== undefined && (!Array.isArray(body.relationLinks) || body.relationLinks.length > 50 || body.relationLinks.some((row) => !row || typeof row !== "object" || !["before", "after"].includes(row.direction) || typeof row.targetId !== "string" || row.targetId.length>150 || typeof row.condition !== "string" || row.condition.length>2000))) return "请检查 Skill 关联";
  if(Array.isArray(body.relationLinks)&&new Set(body.relationLinks.map(row=>`${row.direction}:${row.targetId}`)).size!==body.relationLinks.length)return "同一方向请勿重复关联相同 Skill";
  if (body.toolList !== undefined && (!Array.isArray(body.toolList) || body.toolList.length > 100 || body.toolList.some(name => typeof name !== "string" || !name.trim() || name.length > 200) || new Set(body.toolList).size !== body.toolList.length)) return "工具名称不能为空、不能重复，最多 100 项";
  if (body.toolDescriptions !== undefined && (!body.toolDescriptions || typeof body.toolDescriptions !== "object" || Array.isArray(body.toolDescriptions) || Object.keys(body.toolDescriptions).length > 100 || Object.entries(body.toolDescriptions).some(([name, purpose]) => name.length > 200 || typeof purpose !== "string" || purpose.length > 2000))) return "请检查工具功能说明";
  if (type !== "OTHER") for (const field of ["name", "summary"]) if (body[field] !== undefined && !String(body[field]).trim()) return "名称和简介不能为空";
  if (type === "MCP" && body.dataPermissions !== undefined && parsePermissions(body.dataPermissions).some(row => !row.table.trim() || !row.purpose.trim())) return "请填写每项数据范围和作用";
  if (type === "MCP" && creating && !String(body.accessMethod ?? "").trim()) return "请填写 MCP 接入方式";
  if (type === "AGENT" && creating && (!String(body.sourceUrl ?? "").trim() || !String(body.detail ?? "").trim() || !String(body.usageInstructions ?? body.usageExample ?? "").trim())) return "请填写 Agent 访问链接、适用说明和使用说明";
  if (type === "SKILL") {
    if (creating && !String(body.contact??"").trim()) return "请填写联系人";
    if ((creating || body.documentationUrl !== undefined) && !String(body.documentationUrl??"").trim()) return "请填写使用文档链接";
    if (body.businessDirection !== undefined && !SKILL_CATEGORIES.some((item) => item.id === body.businessDirection)) return "请选择有效的业务分类";
  }
  if (body.usageExample && typeof body.usageExample === "string" && isUsageGuide(body.usageExample)) return "使用指令示例请填写能直接发送给 Agent 的指令；操作步骤请填写在使用说明中，示例可留空";
  if (body.installationMode === "required" && !String(body.installationCommand ?? "").trim()) return "需要安装时，请填写安装指令";
  if (body.repositoryAccess === "private" && !String(body.repositoryInstructions ?? "").trim()) return "私有仓库请填写权限申请步骤及联系人";
  return null;
}

export type RelationInput = { direction: "before" | "after"; targetId: string; condition: string };

export function parseCommonQa(value: unknown): CommonQa[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is CommonQa => Boolean(row && typeof row.question === "string" && typeof row.answer === "string")).map(row => ({ question: row.question.trim(), answer: row.answer.trim() }));
}
