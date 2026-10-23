import type { DataPermission } from "@/lib/resource-types";
import { parsePermissions } from "@/lib/resource-input";
import type { BatchItem } from "drizzle-orm/batch";
import { runBatches } from "@/lib/db-batch";
import { DEFAULT_WEBSITE_CATEGORIES, suggestedWebsiteCategory } from "@/lib/website-categories";
import { AGENT_REFERENCES } from "@/lib/agent-references";
import { and, eq, isNull, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { appState, resources, skillRelations, users, websiteCategories } from "@/db/schema";
import { MCP_CONTENT_UPDATES, TIGER_MCP_INSTALL, DATA_MCP_INSTALL, TIGER_MCP_TOOLS, DATA_MCP_TOOLS } from "@/lib/mcp-content";
import { getResourceModule } from "@/lib/resource-modules";
import { RESOURCE_CONTENT_UPDATES } from "@/lib/resource-content";

const INITIAL_USERS = [
  ["usr-ruby", "ruby.li@dida.com", "Ruby", "ADMIN"],
  ["usr-terrence", "terrence.yang@dida.com", "Terrence", "CREATOR"],
  ["usr-jason-huang", "jason.huang@dida.com", "Jason Huang", "CREATOR"],
  ["usr-lumino", "lumino.zheng@dida.com", "Lumino", "CREATOR"],
  ["usr-lea", "lea.wang@dida.com", "Lea", "CREATOR"],
  ["usr-kristine", "kristine.liu@dida.com", "Kristine", "VIEWER"],
  ["usr-banks", "banks.feng@dida.com", "Banks", "VIEWER"],
  ["usr-gloria", "gloria.gao@dida.com", "Gloria", "VIEWER"],
  ["usr-danny", "danny.wang@dida.com", "Danny", "VIEWER"],
  ["usr-william", "william.xia@dida.com", "William", "VIEWER"],
  ["usr-yuki", "yuki.bai@dida.com", "Yuki", "VIEWER"],
  ["usr-eden", "eden.hong@dida.com", "Eden", "VIEWER"],
  ["usr-carinna", "carinna.hu@dida.com", "Carinna", "VIEWER"],
  ["usr-yara", "yara.peng@dida.com", "Yara", "VIEWER"],
  ["usr-lily", "lily.wang@dida.com", "Lily", "VIEWER"],
  ["usr-jeffee", "jeffee.jiang@dida.com", "大飞（Jeffee）", "VIEWER"],
  ["usr-neo", "neo.chen@dida.com", "Neo", "VIEWER"],
  ["usr-jack", "jack.feng@dida.com", "Jack", "VIEWER"],
  ["usr-hazel", "hazel.huang@dida.com", "Hazel", "VIEWER"],
  ["usr-iris", "iris.liu@dida.com", "Iris", "VIEWER"],
  ["usr-pollen", "pollen.zhong@dida.com", "Pollen", "VIEWER"],
  ["usr-kelly", "kelly.he@dida.com", "Kelly", "VIEWER"],
  ["usr-max", "max.long@dida.com", "Max", "VIEWER"],
] as const;

const INITIAL_RESOURCES = [
  {
    id: "skill-log-order", type: "SKILL", name: "log-order-skill", slug: "log-order-skill",
    businessDirection: "technical_operations", scenario: "技术运营", summary: "解析 Tiger 订单日志，沉淀异常判断、关键处理与责任边界。",
    version: "1.0.0", tags: ["订单", "日志", "Tiger"], ownerId: "usr-ruby",
    detail: "输入单个 Tiger 日志链接或批量订单号，输出订单异常、关键处理、最终状态、结算结果和待办事项。",
    sourceUrl: null,
  },
  {
    id: "skill-hotel-audit", type: "SKILL", name: "dida-hotel-audit-skill", slug: "dida-hotel-audit-skill",
    businessDirection: "enhanced_matching", scenario: "增强匹配", summary: "核验 Dida 酒店静态信息、外部映射、经纬度、设施与房型。",
    version: "1.0.0", tags: ["酒店", "映射", "静态信息"], ownerId: "usr-jason-huang",
    detail: "适用于酒店同一性判断、GIATA 等外部映射核验，以及政策、设施、房型和图片检查。",
    sourceUrl: null,
  },
  {
    id: "skill-market-alert", type: "SKILL", name: "大盘产量异动分析报警 Skill", slug: "overseas-api-drop-mvp",
    businessDirection: "technical_operations", scenario: "技术运营", summary: "对海外 API 大盘 TTV 进行涨跌定位与异常提醒。",
    version: "1.0.0", tags: ["大盘", "TTV", "报警"], ownerId: "usr-ruby",
    detail: "按 ParentClientID、ClientID、供应商、国家和 Chain 定位主要变化集中点，为后续精细归因确定范围。",
    sourceUrl: null,
  },
  {
    id: "skill-attribution", type: "SKILL", name: "产量异动归因 Skill", slug: "attribution-analysis",
    businessDirection: "technical_operations", scenario: "技术运营", summary: "对 GP、TTV、BKS 等指标的异常波动进行细粒度归因。",
    version: "1.0.0", tags: ["归因", "GP", "TTV", "BKS"], ownerId: "usr-lumino",
    detail: "在明确重点日期或 Client 后，沿客户、供应商、渠道在线时长和业务维度继续深查。",
    sourceUrl: null,
  },
  {
    id: "skill-supplier", type: "SKILL", name: "供应商优势资源分析 Skill", slug: "supplier-analysis",
    businessDirection: "resource_optimization", scenario: "资源优化", summary: "分析供应商优势、独家酒店、客户结构和预订模式。",
    version: "1.0.0", tags: ["供应商", "优势资源", "酒店"], ownerId: "usr-lumino",
    detail: "用于识别供应商优势资源、独家酒店、资源优势方、准确率和失败率等表现。",
    sourceUrl: null,
  },
  {
    id: "skill-l2l", type: "SKILL", name: "L2L 配置查询与 BRG 降级分析 Skill", slug: "l2l-downgrade",
    businessDirection: "resource_optimization", scenario: "资源优化", summary: "查询 L2L、资源等级和 BRG 配置，并评估降级影响。",
    version: "1.0.0", tags: ["L2L", "BRG", "降级"], ownerId: "usr-lea",
    detail: "适用于当前资源等级、历史 BRG、特殊配置、售卖规则及潜在 BKS/TTV 影响分析。",
    sourceUrl: null,
  },
  {
    id: "mcp-tiger", type: "MCP", name: "tiger-mcp", slug: "tiger-mcp",
    businessDirection: null, scenario: "订单日志", summary: "访问并解析 Tiger 订单操作日志。", version: null,
    tags: ["Tiger", "订单日志"], ownerId: "usr-ruby", detail: "面向订单异常排查和处理记录核验。",
    accessData: null, accessMethod: "通过内部 MCP 配置接入", toolList: TIGER_MCP_TOOLS, sourceUrl: null,
  },
  {
    id: "mcp-data", type: "MCP", name: "data-mcp", slug: "data-mcp",
    businessDirection: null, scenario: "数据分析", summary: "查询海外线上渠道业务指标与明细数据。", version: null,
    tags: ["数据", "指标", "SQL"], ownerId: "usr-ruby", detail: "为分析 Skill 提供指标、数据表结构和明细查询能力。",
    accessData: null, accessMethod: "通过内部 MCP 配置接入", toolList: DATA_MCP_TOOLS, sourceUrl: null,
  },
  {
    id: "agent-dida-api", type: "AGENT", name: "DidaAPI 问答小助手", slug: "dida-api-assistant",
    businessDirection: null, scenario: "知识问答", summary: "基于海外线上渠道公开知识库的 DidaAPI 问答助手。", version: null,
    tags: ["Agent", "公开知识库", "DidaAPI"], ownerId: "usr-ruby", detail: "适合查询可以在海外线上渠道公开知识库中回答的问题。",
    knowledgeScope: "海外线上渠道公开知识库", sourceUrl: "https://dragon.didaadmin.com/chat?applicationId=08de783f-57d6-4f8e-829a-c8ab2bd7fce6",
  },
  {
    id: "agent-sponge", type: "AGENT", name: "Sponge 问答小助手", slug: "sponge-assistant",
    businessDirection: null, scenario: "知识问答", summary: "基于海外线上渠道私有知识库的问答助手。", version: null,
    tags: ["Agent", "私有知识库", "Sponge"], ownerId: "usr-ruby", detail: "适合查询需要内部私有知识库支持的问题。",
    knowledgeScope: "海外线上渠道私有知识库", sourceUrl: "https://dragon.didaadmin.com/chat?applicationId=08df155c-0294-4974-8e7a-5b08ac2b4770",
  },
  {
    id: "site-angrybirds", type: "INTERNAL", name: "AngryBirds", slug: "angrybirds",
    businessDirection: null, scenario: "overseas_op", summary: "道旅 CRM，管理机构、供应商和通讯录。", version: null,
    tags: ["内部网站", "AngryBirds"], ownerId: "usr-ruby", detail: "海外渠道团队常用内部网站入口。",
    sourceUrl: "https://angrybirds.didaadmin.com/",
  },
  {
    id: "site-analysis", type: "INTERNAL", name: "Analysis", slug: "analysis",
    businessDirection: null, scenario: "overseas_op", summary: "支持日志分析、报表分析、BI 分析和 Dashboard 看板。", version: null,
    tags: ["内部网站", "分析"], ownerId: "usr-ruby", detail: "海外渠道团队常用分析网站入口。",
    sourceUrl: "https://a.didaadmin.com/",
  },
  {
    id: "site-content", type: "INTERNAL", name: "Content", slug: "content",
    businessDirection: null, scenario: "overseas_op", summary: "酒店静态信息管理与各类匹配工具。", version: null,
    tags: ["内部网站", "内容"], ownerId: "usr-ruby", detail: "海外渠道团队常用内容网站入口。",
    sourceUrl: "https://content.didaadmin.com/",
  },
  {
    id: "site-tiger-v2", type: "INTERNAL", name: "Tiger_v2", slug: "tiger-v2",
    businessDirection: null, scenario: "overseas_op", summary: "订单管理，查询订单详情与操作日志。", version: null,
    tags: ["内部网站", "Tiger"], ownerId: "usr-ruby", detail: "海外渠道团队常用 Tiger_v2 网站入口。",
    sourceUrl: "https://tiger-v2.didaadmin.com/",
  },
  {
    id: "site-wolf-v1", type: "INTERNAL", name: "Wolf_v1", slug: "wolf-v1",
    businessDirection: null, scenario: "overseas_op", summary: "接口测试工具，支持技术运营指标监控与配置。", version: null,
    tags: ["内部网站", "Wolf"], ownerId: "usr-ruby", detail: "海外渠道团队常用 Wolf_v1 网站入口。",
    sourceUrl: "https://wolf.didaadmin.com/",
  },
  {
    id: "site-wolf-v2", type: "INTERNAL", name: "Wolf_v2", slug: "wolf-v2",
    businessDirection: null, scenario: "overseas_op", summary: "调价与资源配置。", version: null,
    tags: ["内部网站", "Wolf"], ownerId: "usr-ruby", detail: "海外渠道团队常用 Wolf_v2 网站入口。",
    sourceUrl: "https://wolf-v2.didaadmin.com/",
  },
  {
    id: "site-quickbi", type: "INTERNAL", name: "QuickBI", slug: "quickbi",
    businessDirection: null, scenario: "overseas_op", summary: "BI 报表与数据分析，制作和查看业务看板。", version: null,
    tags: ["内部网站", "BI", "数据分析"], ownerId: "usr-ruby", detail: "海外渠道团队常用 QuickBI 网站入口。",
    sourceUrl: "https://bi.aliyun.com/",
  },
] as const;

const RESOURCE_GUIDES: Record<string, { installationCommand: string; usageExample: string; documentationUrl?: string }> = {
  "log-order-skill": {
    installationCommand: "帮我安装这个 Skill：\nhttps://github.com/rubyli0615/log-order-skill",
    usageExample: "安装完成后，把单个 Tiger 日志链接发给 AI，或上传包含渠道订单号/供应商订单号的 Excel，并说明需要分析订单异常、关键处理、最终状态、结算结果和待办事项。",
    documentationUrl: "https://didatravel.feishu.cn/wiki/QB7NwqFHrihELpkT89hcptpYnmf",
  },
  "overseas-api-drop-mvp": {
    installationCommand: "该 Skill 由定时任务统一运行，无需个人安装。请联系维护人 Ruby 确认飞书群推送范围和报警口径。",
    usageExample: "每天 09:30 查看飞书群的大盘异动推送；发现明确的异常日期、指标或重点 Client 后，再进入产量异动归因 Skill 深查。",
  },
  "dida-hotel-audit-skill": {
    installationCommand: "帮我安装并配置 dida-hotel-audit：\nhttps://github.com/huangxiaozhen/dida-hotel-audit\n请完成全局安装，运行 Skill 自带的 scripts/configure.py 配置，并用 scripts/credential_status.py 验证。LicenseKey 仅在本地输入，不要回显或写入资源中心。",
    usageExample: "提供 Dida 酒店 ID，并说明需要核验酒店同一性、GIATA 映射、经纬度、政策、设施、房型或图片中的哪一项。",
  },
  "attribution-analysis": {
    installationCommand: "请把公开仓库安装为 attribution-analysis Skill：\nhttps://github.com/QianhaoZheng-Lumino/attribution-analysis\n按当前 runtime 的 skills 目录克隆，根目录必须直接包含 SKILL.md。安装后配置 user-data-mcp，先阅读 README.md 的使用前注意事项并完成权限自测。",
    usageExample: "说明需要调查的异常日期、指标或 Client；如果尚未定位范围，先使用大盘产量异动分析报警 Skill，再使用本 Skill 做细粒度归因。",
  },
  "supplier-analysis": {
    installationCommand: "请帮我安装并使用 supplier-analysis Skill。安装前先向维护人 Lumino 确认团队内部仓库地址，安装目录根层必须直接包含 SKILL.md。",
    usageExample: "提供供应商名称或 ID，并说明希望分析优势酒店、独家资源、客户结构、预订模式、有价率、准确率还是失败率。",
  },
  "l2l-downgrade": {
    installationCommand: "请帮我安装并使用 l2l-downgrade Skill。安装前先向维护人 Lea 确认团队内部仓库和所需数据权限。",
    usageExample: "提供 ClientID 和查询日期，说明需要核验资源等级、L2L 配置、BRG 变化，还是评估降级对 BKS/TTV 的影响。",
  },
  "tiger-mcp": {
    installationCommand: TIGER_MCP_INSTALL,
    usageExample: "连接成功后，可按渠道订单号或供应商订单号查询操作日志，也可以让支持该 MCP 的 AI 批量获取订单日志。",
  },
  "data-mcp": {
    installationCommand: DATA_MCP_INSTALL,
    usageExample: "先搜索指标或数据表，再查看表结构和口径，最后执行只读查询；不要在未确认口径时直接下结论。",
  },
  "dida-mcp": {
    installationCommand: "请帮我接入 dida-mcp。按团队内部 MCP 配置完成授权，列出可用工具，并先执行一次酒店信息只读查询验证连接。个人密钥仅在本地输入。",
    usageExample: "连接成功后，说明需要查询的 Dida 业务对象、酒店 ID 或数据范围，再选择对应工具执行。",
  },
};

const BOOTSTRAP_VERSION = 35;

// The marker lives in D1, not in process memory: cold Workers also skip completed work.
let bootstrapReady: Promise<void> | null = null;
export function ensureBootstrapData() {
  if (!bootstrapReady) bootstrapReady = initializeBootstrapData().catch(error => { bootstrapReady = null; throw error; });
  return bootstrapReady;
}
async function initializeBootstrapData() {
  const db = getDb();
  const markers = await db.select().from(appState);
  const completed = new Set(markers.map(item=>item.key));
  const marker = markers.find(item=>item.key==="bootstrap");
  if (marker && marker.version >= BOOTSTRAP_VERSION) { await ensureModuleInventoryUpdate(completed); await ensureCatalogContentUpdate(completed); await ensureRequestedContent41(completed); await ensureRequestedContent44(completed); await ensureRequestedContent45(completed); return; }
  const now = Math.floor(Date.now() / 1000);
  const initial: BatchItem<"sqlite">[] = [];
  const userRows = INITIAL_USERS.map(([id, email, displayName, role]) => ({ id, email, displayName, role, active: true, createdAt: now, updatedAt: now }));
  for (let offset = 0; offset < userRows.length; offset += 10) initial.push(db.insert(users).values(userRows.slice(offset, offset + 10)).onConflictDoNothing());
  for (const user of userRows) initial.push(db.update(users).set({ email: user.email, displayName: user.displayName, role: user.role }).where(eq(users.id, user.id)));
  const resourceRows = INITIAL_RESOURCES.map(item => ({
    id: item.id, type: item.type, name: item.name, slug: item.slug, businessDirection: item.businessDirection, scenario: item.scenario,
    summary: item.summary, version: item.version, tags: JSON.stringify(item.tags), detail: item.detail,
    installationCommand: RESOURCE_GUIDES[item.slug]?.installationCommand ?? null, usageExample: RESOURCE_GUIDES[item.slug]?.usageExample ?? null,
    documentationUrl: RESOURCE_GUIDES[item.slug]?.documentationUrl ?? null, sourceUrl: item.sourceUrl,
    accessData: "accessData" in item ? item.accessData : null, accessMethod: "accessMethod" in item ? item.accessMethod : null,
    toolList: JSON.stringify("toolList" in item ? item.toolList : []), knowledgeScope: "knowledgeScope" in item ? item.knowledgeScope : null,
    ownerId: item.ownerId, status: "PUBLISHED" as const, releaseNote: "首版录入", createdAt: now, updatedAt: now,
  }));
  for (let offset = 0; offset < resourceRows.length; offset += 3) initial.push(db.insert(resources).values(resourceRows.slice(offset, offset + 3)).onConflictDoNothing());
  for (const category of DEFAULT_WEBSITE_CATEGORIES) initial.push(db.insert(websiteCategories).values({ ...category, nameKey: category.name.normalize("NFKC").toLowerCase(), createdAt: now, updatedAt: now }).onConflictDoNothing());
  await runBatches(initial);
  const initializeRelations = (await db.select({ id: resources.id }).from(resources).where(and(eq(resources.slug, "attribution-analysis"), eq(resources.contentRevision, 0)))).length > 0;
  const updates: BatchItem<"sqlite">[] = [];
  const legacySummaries: Record<string, string> = { "site-angrybirds": "进入 AngryBirds 内部工作平台。", "site-analysis": "进入 Analysis 内部分析平台。", "site-content": "进入 Content 内部内容平台。", "site-tiger-v2": "进入 Tiger_v2 内部系统。", "site-wolf-v1": "进入 Wolf_v1 内部系统。", "site-wolf-v2": "进入 Wolf_v2 内部系统。", "site-quickbi": "进入 QuickBI 数据分析平台。" };
  for (const item of INITIAL_RESOURCES.filter(resource => resource.type === "INTERNAL")) {
    updates.push(db.update(resources).set({ scenario: item.scenario }).where(eq(resources.id, item.id)));
    updates.push(db.update(resources).set({ summary: item.summary }).where(and(eq(resources.id, item.id), eq(resources.summary, legacySummaries[item.id]))));
  }
  for (const item of INITIAL_RESOURCES) {
    const guide = RESOURCE_GUIDES[item.slug];
    if (guide) updates.push(db.update(resources).set({ installationCommand: guide.installationCommand, usageExample: guide.usageExample, documentationUrl: guide.documentationUrl ?? null }).where(and(eq(resources.id, item.id), eq(resources.contentRevision, 0), isNull(resources.installationCommand))));
  }
  for (const [slug, content] of Object.entries(RESOURCE_CONTENT_UPDATES)) updates.push(db.update(resources).set({ ...content, dataPermissions: JSON.stringify(content.dataPermissions ?? []), version: "1.0.0", contentRevision: 22 }).where(and(eq(resources.slug, slug), eq(resources.contentRevision, 0))));
  updates.push(db.update(resources).set({ version: "1.0.0", installationMode: "required", contentRevision: 22 }).where(and(eq(resources.type, "SKILL"), eq(resources.contentRevision, 0), isNotNull(resources.installationCommand))));
  updates.push(db.update(resources).set({ version: "1.0.0", contentRevision: 22 }).where(and(eq(resources.type, "SKILL"), eq(resources.contentRevision, 0))));
  updates.push(db.update(resources).set({ installationMode: "required", contentRevision: 22 }).where(and(eq(resources.type, "MCP"), eq(resources.contentRevision, 0), isNotNull(resources.installationCommand))));
  for (const { id, toolList, ...content } of MCP_CONTENT_UPDATES) updates.push(db.update(resources).set({ ...content, toolList: JSON.stringify(toolList), installationMode: "required", contentRevision: 25 }).where(and(eq(resources.id, id), lt(resources.contentRevision, 25))));
  updates.push(db.update(resources).set({ status: "ARCHIVED" }).where(eq(resources.slug, "dida-mcp")));
  for (const [slug, referenceUrl] of Object.entries(AGENT_REFERENCES)) updates.push(db.update(resources).set({ referenceUrl }).where(and(eq(resources.slug, slug), isNull(resources.referenceUrl))));
  if (initializeRelations) updates.push(db.insert(skillRelations).values([
    { id: "rel-alert-attribution", sourceSkillId: "skill-market-alert", targetSkillId: "skill-attribution", triggerCondition: "大盘分析发现明确的异常日期、指标或重点 Client 后，进入详细归因。", createdAt: now },
    { id: "rel-attribution-l2l", sourceSkillId: "skill-attribution", targetSkillId: "skill-l2l", triggerCondition: "归因结果指向资源等级、L2L 配置或 BRG 变化时继续分析。", createdAt: now },
  ]).onConflictDoNothing());
  await runBatches(updates);
  const sites = await db.select().from(resources).where(and(eq(resources.type, "INTERNAL"), isNull(resources.websiteCategoryId)));
  const categoryUpdates: BatchItem<"sqlite">[] = [];
  for (const site of sites) {
    const websiteCategoryId = suggestedWebsiteCategory(site);
    if (websiteCategoryId) categoryUpdates.push(db.update(resources).set({ websiteCategoryId }).where(and(eq(resources.id, site.id), isNull(resources.websiteCategoryId))));
  }
  await runBatches(categoryUpdates);
  await ensureModuleInventoryUpdate(completed);
  await ensureCatalogContentUpdate(completed); await ensureRequestedContent41(completed); await ensureRequestedContent44(completed); await ensureRequestedContent45(completed);
  // Write completion only after every seed/editorial operation has succeeded.
  await db.insert(appState).values({ key: "bootstrap", version: BOOTSTRAP_VERSION, updatedAt: now }).onConflictDoUpdate({ target: appState.key, set: { version: BOOTSTRAP_VERSION, updatedAt: now } });
}

// Separate durable marker: do not replay older seeds or recreate categories users deleted.
async function ensureModuleInventoryUpdate(completed?: Set<string>) {
  const db = getDb();
  const marker = completed ? completed.has("modules-inventory-36") : (await db.select().from(appState).where(eq(appState.key, "modules-inventory-36")).limit(1))[0];
  if (marker) return;
  const now = Math.floor(Date.now() / 1000);
  const updates: BatchItem<"sqlite">[] = [];
  const unassigned = await db.select().from(resources).where(isNull(resources.resourceModule));
  for (const resource of unassigned) updates.push(db.update(resources).set({ resourceModule: getResourceModule(resource) }).where(and(eq(resources.id, resource.id), isNull(resources.resourceModule))));
  for (const { id, toolList, accessData, documentationUrl } of MCP_CONTENT_UPDATES) updates.push(db.update(resources).set({
    toolList: JSON.stringify(toolList), accessData, documentationUrl, contentRevision: 36, updatedAt: now,
    notificationRevision: sql`${resources.notificationRevision} + 1`, notificationKind: "updated", notificationAt: now,
  }).where(and(eq(resources.id, id), lt(resources.contentRevision, 36))));
  await runBatches(updates);
  await db.insert(appState).values({ key: "modules-inventory-36", version: 1, updatedAt: now }).onConflictDoNothing();
}

// Apply this requested editorial correction once, preserving later creator edits and all keys.
async function ensureCatalogContentUpdate(completed?: Set<string>) {
  const db = getDb();
  if (completed ? completed.has("catalog-content-38") : (await db.select().from(appState).where(eq(appState.key, "catalog-content-38")).limit(1))[0]) return;
  const now = Math.floor(Date.now() / 1000);
  const revisions = {
    contentRevision: sql`max(${resources.contentRevision}, 38) + 1`, updatedAt: now,
    notificationRevision: sql`${resources.notificationRevision} + 1`,
    notificationKind: "updated" as const, notificationAt: now,
  };
  const updates: BatchItem<"sqlite">[] = [];
  for (const { id, toolList, accessData } of MCP_CONTENT_UPDATES) updates.push(db.update(resources).set({
    toolList: JSON.stringify(toolList), accessData, ...revisions,
  }).where(eq(resources.id, id)));
  for (const [slug, detail] of [
    ["dida-api-assistant", "适合快速入门所有 API 相关的知识或者针对专门的问题咨询小助手"],
    ["sponge-assistant", "适合查询海外线上渠道私有知识库支持的问题"],
  ]) updates.push(db.update(resources).set({
    detail, usageExample: "进入对话界面开启对话即可。", ...revisions,
  }).where(eq(resources.slug, slug)));
  updates.push(db.update(resources).set({
    dataPermissions: sql`replace(${resources.dataPermissions}, 'public.clientsloscallcount', 'public.clientloscallcount')`,
    ...revisions,
  }).where(sql`instr(${resources.dataPermissions}, 'public.clientsloscallcount') > 0`));
  updates.push(db.insert(appState).values({ key: "catalog-content-38", version: 1, updatedAt: now }).onConflictDoNothing());
  await runBatches(updates);
}

async function ensureRequestedContent41(completed?: Set<string>) {
  const db=getDb();
  if(completed ? completed.has("requested-content-41") : (await db.select().from(appState).where(eq(appState.key,"requested-content-41")).limit(1))[0])return;
  const now=Math.floor(Date.now()/1000);
  const changed={contentRevision:sql`max(${resources.contentRevision},41)+1`,updatedAt:now,notificationRevision:sql`${resources.notificationRevision}+1`,notificationKind:"updated" as const,notificationAt:now};
  const docs=[
    ["attribution-analysis","https://didatravel.feishu.cn/wiki/KsfGwpNddiT6EakG2f4codBYntc?create_from=create_doc_to_wiki","https://didatravel.feishu.cn/wiki/CMRSwACU7iO1gEkvHiwcpTASnNf?create_from=create_doc_to_wiki"],
    ["supplier-analysis","https://didatravel.feishu.cn/wiki/IV8owZS9Gi3vkEk4xznchnxqnRh?create_from=create_doc_to_wiki","https://didatravel.feishu.cn/wiki/BEZwwlleoimPOBkZHVmcbcQwnyh?create_from=create_doc_to_wiki"],
    ["l2l-downgrade","https://didatravel.feishu.cn/wiki/CRRGwHkqUiE7tdkUKT5caUbAnVf","https://didatravel.feishu.cn/wiki/F2qIwY6R7ijBpckpCtscIwzcnba"],
  ];
  const updates:BatchItem<"sqlite">[]=docs.map(([slug,documentationUrl,referenceUrl])=>db.update(resources).set({documentationUrl,referenceUrl,...changed}).where(eq(resources.slug,slug)));
  updates.push(db.update(resources).set({name:"Dida酒店静态skill",summary:"酒店静态信息查询与处理 Skill",scenario:"酒店静态数据查询",documentationUrl:"https://didatravel.feishu.cn/docx/JjnfdlVGgoTmcQxhPVrcPsGknre",...changed}).where(eq(resources.id,"skill-hotel-audit")));
  const data=(await db.select({accessData:resources.accessData,dataPermissions:resources.dataPermissions,toolDescriptions:resources.toolDescriptions}).from(resources).where(eq(resources.id,"mcp-data")))[0];
  let tables:DataPermission[]=[];
  try{tables=parsePermissions(JSON.parse(data?.dataPermissions??"[]"));}catch{/* Preserve a readable directory if legacy JSON is invalid. */}
  const structured=Array.isArray(tables)&&(tables.length>0||data?.toolDescriptions!==null);
  if(!data?.accessData?.includes("data_ovs.weekly_bookable_hotel") || structured&&!tables.some(row=>row.table==="data_ovs.weekly_bookable_hotel"))updates.push(db.update(resources).set({
    accessData:((data?.accessData??"").replace("36 张候选表","37 张候选表"))+(data?.accessData?.includes("data_ovs.weekly_bookable_hotel")?"":"\n"+"data_ovs.weekly_bookable_hotel"),
    ...(structured&&!tables.some(row=>row.table==="data_ovs.weekly_bookable_hotel")?{dataPermissions:JSON.stringify([...tables,{priority:"按需申请",table:"data_ovs.weekly_bookable_hotel",purpose:"每周可订酒店（Bookable Hotel）数据；字段与统计口径以元数据为准。"}])}:{}),...changed,
  }).where(eq(resources.id,"mcp-data")));
  updates.push(db.insert(appState).values({key:"requested-content-41",version:1,updatedAt:now}).onConflictDoNothing());
  await runBatches(updates);
}
async function ensureRequestedContent44(completed?:Set<string>) {
  const db=getDb(),key="requested-content-44";
  if(completed?completed.has(key):(await db.select().from(appState).where(eq(appState.key,key)).limit(1))[0])return;
  const now=Math.floor(Date.now()/1000);
  await db.batch([
    db.update(resources).set({documentationUrl:"https://didatravel.feishu.cn/wiki/BB7hwCVXtiPD3pkNf6scUxXFnTh",contentRevision:sql`max(${resources.contentRevision},44)+1`,updatedAt:now,notificationRevision:sql`${resources.notificationRevision}+1`,notificationKind:"updated",notificationAt:now}).where(eq(resources.slug,"overseas-api-drop-mvp")),
    db.insert(appState).values({key,version:1,updatedAt:now}).onConflictDoNothing(),
  ]);
}
async function ensureRequestedContent45(completed?:Set<string>) {
 const db=getDb(),key="requested-content-45";
 if(completed?completed.has(key):(await db.select().from(appState).where(eq(appState.key,key)).limit(1))[0])return;
 const now=Math.floor(Date.now()/1000);
 const updates:BatchItem<"sqlite">[]=[
  ...[["tiger-mcp","tiger_user_key"],["data-mcp","agent_user_key"]].map(([slug,header])=>db.update(resources).set({
    accessMethod:"复制下方安装指令后，请在自己的 AI 客户端中将 "+header+" 的占位内容替换为本人真实鉴权 Key，再执行安装。不要将填写了 Key 的指令转发给他人。",
    contentRevision:sql`max(${resources.contentRevision},45)+1`,updatedAt:now,
  }).where(eq(resources.slug,slug))),
  db.insert(appState).values({key,version:1,updatedAt:now}).onConflictDoNothing(),
 ];
 await runBatches(updates);
}
