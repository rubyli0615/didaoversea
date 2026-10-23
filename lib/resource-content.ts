import type { DataPermission } from "./resource-types";

// Publisher-provided installation text. Preserve wording and paths verbatim.
export const ATTRIBUTION_INSTALL = String.raw`请把公开 GitHub 仓库 [GitHub - QianhaoZheng-Lumino/attribution-analysis: Hotel Overseas API yield attribution skill (user-](https://github.com/QianhaoZheng-Lumino/attribution-analysis) 安装为 attribution-analysis Skill（Public，无需登录即可 clone）。

按当前 runtime 的 skills 目录克隆，根下必须直接有 SKILL.md（不要多套一层文件夹）：

- Cursor：$HOME/.cursor/skills/attribution-analysis/（Windows 为 %USERPROFILE%\.cursor\skills\attribution-analysis）

- Claude Code：$HOME/.claude/skills/attribution-analysis/

- Codex：$HOME/.agents/skills/attribution-analysis/

我已配置 user-data-mcp（自己的 key）。安装后用于酒店 Overseas API 产量异动归因；先读 README.md「使用前注意事项」并完成「权限自测」，再按 SKILL.md 执行模式跑。`;

export const SUPPLIER_INSTALL = String.raw`请把公开 GitHub 仓库 [GitHub - QianhaoZheng-Lumino/supplier-analysis: 酒店 Overseas API 供应商分析 Agent Skill。仓库不含 data MCP 密钥。](https://github.com/QianhaoZheng-Lumino/supplier-analysis) 安装为 supplier-analysis Skill（Public，无需登录即可 clone）。
按当前 runtime 的 skills 目录克隆，根下必须直接有 SKILL.md（不要多套一层文件夹）：
- Cursor：$HOME/.cursor/skills/supplier-analysis/（Windows 为 %USERPROFILE%\.cursor\skills\supplier-analysis）
- Claude Code：$HOME/.claude/skills/supplier-analysis/
- Codex：$HOME/.agents/skills/supplier-analysis/
我已配置 user-data-mcp（自己的 key）。安装后用于酒店 Overseas API 供应商分析；先读 README.md「使用前注意事项」，再按 SKILL.md 执行。`;

export const ATTRIBUTION_PERMISSIONS: DataPermission[] = [
  { priority: "P0", table: "public.npd_booking_view", purpose: "缺少时整条归因停止（Phase 1/2 BKS）" },
  { priority: "P0", table: "content.dida_hotel_view", purpose: "国家/连锁下钻、节假日同比 BKS" },
  { priority: "P1", table: "crm.client_info_ods", purpose: "配 parent 时 3a 展开 client" },
  { priority: "P1", table: "configuration.wolf_rateadjust_log", purpose: "CS/C/S/CSA/CBD/SBD 配置核验" },
  { priority: "P1", table: "configuration.wolf_rateadjust_hotel_log", purpose: "CDH/SH/LCDH 配置核验" },
  { priority: "P1", table: "configuration.wolfl2lclientlevelconfiglog", purpose: "L2L 配置核验" },
  { priority: "P1", table: "configuration.wolfl2lconfiglog", purpose: "CSLRC 配置核验" },
  { priority: "P1", table: "configuration.bottom_margin_log", purpose: "C/S Bottom 核验" },
  { priority: "P1", table: "configuration.client_configuration_change_log", purpose: "Configuration 核验" },
  { priority: "P1", table: "ads.ads_hotel_monitor_rate_search_statistic_by_client_id", purpose: "机构级 DidaBiz 查价；不可用时走 funnel fallback" },
  { priority: "P1", table: "public.clientsupplierhotelcallcountsummary", purpose: "SS 查价（CS 近似）" },
  { priority: "P1", table: "data_ovs.didamonitor_funnel_client_country", purpose: "ads 失败时国家 PPS 及退路" },
  { priority: "P1", table: "data_ovs.didamonitor_funnel_client_chain", purpose: "连锁查价下钻" },
  { priority: "P1", table: "data_ovs.rate_accuracy_channel_multi_dimension", purpose: "缺少时验价准确率链路中断" },
  { priority: "P1 · 可后补", table: "public.clientloscallcount", purpose: "QPS × LOS 次要下钻" },
  { priority: "P1 · 可后补", table: "public.clientleadtimecallcount", purpose: "QPS × leadtime 次要下钻" },
  { priority: "P1 · 可后补", table: "public.clientnationalitycallcount", purpose: "QPS × nationality 次要下钻" },
  { priority: "P2", table: "rateaccuracy.channel_online_states_new", purpose: "渠道上下线、在线时长" },
  { priority: "P2", table: "dws.dws_hotel_flow_didamonitor_supplier_csa_di", purpose: "SS 限流、缓存" },
  { priority: "P2", table: "ads.ads_marketing_calendar_event_wide_d_f", purpose: "Phase 3d 节假日外部事件" },
];

export const L2L_PERMISSIONS: DataPermission[] = [
  { priority: "核心必需", table: "public.npd_booking_view", purpose: "订单、BKS/TTV、当前 TPS/DC 等级" },
  { priority: "核心必需 · 重点", table: "data_ovs.brg_log", purpose: "BRG 历史分组、时间窗及等级；新表，请重点检查权限" },
  { priority: "核心必需", table: "configuration.mask_l2l_client_supplier_limit_config_v2", purpose: "客户特殊配置的供应商开关" },
  { priority: "核心必需", table: "configuration.mask_l2l_client_supplier_level_rule_config_v2", purpose: "客户特殊配置的账号及规则组" },
  { priority: "核心必需", table: "configuration.mask_l2l_client_rule_config_detail", purpose: "客户特殊规则明细" },
  { priority: "核心必需", table: "configuration.mask_l2l_supplier_limit_config", purpose: "普通 L2L 供应商各等级开关" },
  { priority: "核心必需", table: "configuration.mask_l2l_supplier_level_rule_config", purpose: "普通 L2L 账号各等级规则组" },
  { priority: "核心必需", table: "configuration.mask_l2l_rule_config_detail", purpose: "普通 L2L 规则明细" },
  { priority: "核心必需", table: "configuration.mask_l2l_rule_settings", purpose: "星期、时段、间数、晚数及入住窗口条件" },
  { priority: "Excel 导出", table: "crm.supplier_info_ods", purpose: "供应商名称及 Supplier OP" },
  { priority: "Excel 导出", table: "configuration.wolfl2lclientlevelconfiglog", purpose: "客户初始 TPS 等级" },
  { priority: "补充核验", table: "crm.client_info_ods", purpose: "客户当前等级交叉核对" },
  { priority: "补充核验", table: "content.brand_info_ods", purpose: "品牌与父连锁映射核对" },
];

export const L2L_INSTALL = String.raw`git clone https://github.com/LeaShutingWang/l2l-downgrade.git
cd l2l-downgrade
New-Item -ItemType Directory -Force "$HOME/.agents/skills" | Out-Null
Copy-Item -LiteralPath './l2l-downgrade' -Destination "$HOME/.agents/skills/" -Recurse`;

type ContentUpdate = { installationCommand?: string | null; installationMode: string; implementation?: string; contact?: string; caseUrl?: string; sourceUrl?: string; repositoryAccess?: string; repositoryInstructions?: string; mcpRequirements?: string; dataPermissions?: DataPermission[]; usageExample?: string };
export const RESOURCE_CONTENT_UPDATES: Record<string, ContentUpdate> = {
  "attribution-analysis": {
    installationCommand: ATTRIBUTION_INSTALL, installationMode: "required", sourceUrl: "https://github.com/QianhaoZheng-Lumino/attribution-analysis", repositoryAccess: "public", contact: "Lumino · lumino.zheng@dida.com",
    caseUrl: "https://didatravel.feishu.cn/wiki/WdblwCtSDiRWrckxxr7c2AYnnVg",
    implementation: "通过 user-data-mcp 查询业务指标和明细，按 Skill 的执行模式开展异常定位、维度下钻、证据验证与归因报告输出。",
    mcpRequirements: "先配置本人 user-data-mcp（自己的 key），确认实际企业账号/角色具备下列数据表或视图的只读 SELECT 权限。先读 README.md「使用前注意事项」，并完成「权限自测」。P0 两张 + 配置 7 张 + 查验订 5 张为核心 14 张；三张 QPS 表可后补；在线/限流/节假日使用 P2 三张。",
    dataPermissions: ATTRIBUTION_PERMISSIONS,
    usageExample: "提供供应商（如适用）、渠道/ClientID、分析日期、对比窗口及需要调查的指标。示例：使用 attribution-analysis，调查【渠道/ClientID】在【日期】的 GP/TTV/BKS 异动，先确认范围，再按 SKILL.md 的执行模式开展分析。",
  },
  "supplier-analysis": {
    installationCommand: SUPPLIER_INSTALL, installationMode: "required", sourceUrl: "https://github.com/QianhaoZheng-Lumino/supplier-analysis", repositoryAccess: "public", contact: "Lumino · lumino.zheng@dida.com",
    implementation: "通过本人 user-data-mcp 查询供应商与酒店、客户等维度的数据，按 SKILL.md 分析优势资源、客户结构及业务表现。",
    mcpRequirements: "先配置本人 user-data-mcp（自己的 key），阅读 README.md「使用前注意事项」，按仓库要求确认实际分析数据的只读权限。具体表清单待发布方补充。",
    usageExample: "提供供应商名称或 ID、渠道（如需限定）及日期范围。示例：使用 supplier-analysis，分析【供应商】在【日期范围】的优势资源和客户结构，渠道范围为【渠道/全部】。",
  },
  "l2l-downgrade": {
    installationCommand: L2L_INSTALL, installationMode: "required", sourceUrl: "https://github.com/LeaShutingWang/l2l-downgrade", repositoryAccess: "private", contact: "Lea · lea.wang@dida.com",
    repositoryInstructions: "先把你的 GitHub 用户名或个人主页链接发给 Lea，由维护人邀请你访问私有仓库。收到邀请后，使用对应账号接受。安装 Git；Git 登录时请使用获邀账号。",
    mcpRequirements: "请确认本人实际使用 Data MCP 的企业账号/角色具有下列数据表或视图的只读 SELECT 权限。申请理由：需要通过企业 Data MCP 查询客户等级、BRG 历史、订单及售卖配置，进行只读分析并生成报告。申请上述表/视图的 SELECT 权限。",
    dataPermissions: L2L_PERMISSIONS,
    implementation: "结合客户当前 TPS/DC 等级、BRG 历史、订单和售卖配置执行只读分析，生成降级影响 PDF，也支持查询配置及导出特殊配置 Excel。",
    usageExample: "配置好 Data MCP 和权限后，在 Codex 中输入：\n“使用 l2l-downgrade，查询【客户名】当前 TPS/DC 等级，并列出历史 BRG 组，先让我选。”\n\n选定组号后，继续完成降级影响分析并生成 PDF。也支持单独查询普通 L2L 配置、客户特殊配置，以及导出特殊配置 Excel。\n\nWindows 安装说明：上述命令适用于首次安装。已有同名 Skill 的同事请更新原安装目录，不要重复安装。需要复制整个 Skill 文件夹，不能只复制 SKILL.md。安装后若未显示，请重启 Codex。",
  },
  "overseas-api-drop-mvp": { installationMode: "none", contact: "Ruby · ruby.li@dida.com", implementation: "由团队定时任务运行，定位大盘 TTV 涨跌及主要变化集中点，并推送至飞书群。" },
  "log-order-skill": { installationMode: "required", sourceUrl: "https://github.com/rubyli0615/log-order-skill", repositoryAccess: "public", contact: "Ruby · ruby.li@dida.com" },
  "dida-hotel-audit-skill": { installationMode: "required", sourceUrl: "https://github.com/huangxiaozhen/dida-hotel-audit", repositoryAccess: "public", contact: "Jason · jason.huang@dida.com", mcpRequirements: "准备本人 Dida Content API LicenseKey。密钥在本地配置，不上传至资源中心。" },
};
