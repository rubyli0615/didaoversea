// Sanitized directory from owner-provided tool list and local 2026-10-22 evidence.
// Tool presence and table references do not prove current account permissions.
export const MCP_INVENTORY_DATE = "2026-10-22";
export const MCP_INVENTORY_TOOLS = {
  "tiger-mcp": [
    {
      "name": "tiger-mcp_query_booking_technical_logs",
      "purpose": "查询订单技术日志，用于排查接口交互与技术异常。"
    },
    {
      "name": "tiger-mcp_query_booking_basic_info",
      "purpose": "查询订单基本信息，用于核对订单概况。"
    },
    {
      "name": "tiger-mcp_query_booking_operation_logs",
      "purpose": "查询订单操作日志，用于追踪处理过程和状态变化；本地调用使用 bookingNumber、languageType=zh_CN。"
    }
  ],
  "data-mcp": [
    {
      "name": "data-mcp_search_meta_data",
      "purpose": "检索数据表及元数据，了解可查询的数据结构；搜索结果不代表查询权限。"
    },
    {
      "name": "data-mcp_execute_sql",
      "purpose": "执行 SQL 查询，查询业务明细和汇总数据；请仅执行授权范围内的只读查询。"
    },
    {
      "name": "data-mcp_search_metrics",
      "purpose": "检索指标平台的指标与业务口径。"
    },
    {
      "name": "data-mcp_get_analyse_dimension_options",
      "purpose": "获取指标分析维度的可选项，辅助设置筛选条件。"
    },
    {
      "name": "data-mcp_analyse_query",
      "purpose": "按照指标平台口径、时间和维度进行分析查询。"
    },
    {
      "name": "data-mcp_get_auto_complete",
      "purpose": "提供查询输入的自动补全建议。"
    }
  ]
} as const;
export const DATA_MCP_TABLES = [
  { name: "data_ovs.weekly_bookable_hotel", purpose: "每周可订酒店（Bookable Hotel）数据，已注册为元数据；按需申请表权限，字段与统计口径以元数据为准。" },
  {
    "name": "ads.ads_hotel_monitor_rate_search_statistic_by_client_id",
    "purpose": "机构级 DidaBiz 查价请求量、有价量，用于查价漏斗和有价率分析。"
  },
  {
    "name": "ads.ads_marketing_calendar_event_wide_d_f",
    "purpose": "营销日历与节假日事件，用于解释国家、城市维度的外部事件影响。"
  },
  {
    "name": "configuration.bottom_margin_log",
    "purpose": "客户 / 供应商 Bottom 调整日志，用于核验底价配置变化。"
  },
  {
    "name": "configuration.client_configuration_change_log",
    "purpose": "客户配置变更记录，用于核验配置变化与业务波动的时间关系。"
  },
  {
    "name": "configuration.mask_l2l_client_rule_config_detail",
    "purpose": "客户特殊 L2L 规则明细，包含允许售卖、规则和范围条件。"
  },
  {
    "name": "configuration.mask_l2l_client_supplier_level_rule_config_v2",
    "purpose": "客户特殊 L2L 账号级规则组，关联客户、供应商账号和规则明细。"
  },
  {
    "name": "configuration.mask_l2l_client_supplier_limit_config_v2",
    "purpose": "客户特殊 L2L 供应商级开关，判断客户与供应商的特殊限制。"
  },
  {
    "name": "configuration.mask_l2l_rule_config_detail",
    "purpose": "普通 L2L 规则明细，核验允许售卖及规则范围。"
  },
  {
    "name": "configuration.mask_l2l_rule_settings",
    "purpose": "普通及特殊 L2L 共用规则条件：星期、时段、间数、晚数与入住窗口。"
  },
  {
    "name": "configuration.mask_l2l_supplier_level_rule_config",
    "purpose": "普通 L2L 供应商账号各等级的规则组映射。"
  },
  {
    "name": "configuration.mask_l2l_supplier_limit_config",
    "purpose": "普通 L2L 供应商各等级的开关及最新更新时间。"
  },
  {
    "name": "configuration.wolf_rateadjust_hotel_log",
    "purpose": "酒店级调价日志，用于 CDH / SH / LCDH 配置核验。"
  },
  {
    "name": "configuration.wolf_rateadjust_log",
    "purpose": "调价日志，用于 CS / C / S / CSA / CBD / SBD 配置核验。"
  },
  {
    "name": "configuration.wolfl2lclientlevelconfiglog",
    "purpose": "客户 L2L / TPS 等级配置日志，用于核验初始等级和等级变更。"
  },
  {
    "name": "configuration.wolfl2lconfiglog",
    "purpose": "CSLRC 等 L2L 配置日志，用于核验客户供应商等级规则变化。"
  },
  {
    "name": "content.brand_info_ods",
    "purpose": "品牌与父连锁映射，用于核对品牌、连锁归属。"
  },
  {
    "name": "content.dida_hotel_view",
    "purpose": "酒店静态属性，用于国家、连锁下钻及节假日同比 BKS 分析。"
  },
  {
    "name": "content.domain_supplier_account",
    "purpose": "供应商账号信息，为供应商账号技术指标补充账号名称。"
  },
  {
    "name": "crm.client_info_ods",
    "purpose": "客户信息，用于 ParentClient 展开、生产客户筛选和当前等级交叉核对。"
  },
  {
    "name": "crm.supplier_info_ods",
    "purpose": "供应商信息，用于补充供应商名称及 Supplier OP 维护人。"
  },
  {
    "name": "data_ovs.brg_log",
    "purpose": "BRG 历史分组、时间窗和等级，用于 BRG 变化及降级影响分析。"
  },
  {
    "name": "data_ovs.didamonitor_funnel_client_chain",
    "purpose": "客户 × 连锁查价漏斗，用于连锁维度查价下钻。"
  },
  {
    "name": "data_ovs.didamonitor_funnel_client_country",
    "purpose": "客户 × 国家查价漏斗，用于国家 PPS 分析及机构级查价数据的补充。"
  },
  {
    "name": "data_ovs.rate_accuracy_channel_multi_dimension",
    "purpose": "渠道多维验价明细与问题字段，用于验价准确率及问题定位。"
  },
  {
    "name": "data_ovs.supplier_analysis_order",
    "purpose": "Overseas API 供应商订单产量视图，用于供应商产量、优势酒店与独家资源分析。"
  },
  {
    "name": "data_ovs.supplier_analysis_tech_index_30d",
    "purpose": "供应商近 30 天技术指标：有价率、准确率、失败率；不包含缺陷率和响应时长。"
  },
  {
    "name": "dwd.dwd_hotel_order_channel_supplier_booking_mf",
    "purpose": "渠道与供应商订单明细，用于客户结构、订单金额及指标分析；金额与供应商产量视图可能采用不同口径。"
  },
  {
    "name": "dws.dws_hotel_flow_didamonitor_supplier_csa_di",
    "purpose": "供应商 CSA 日级查价流量，用于 SS 限流及缓存分析。"
  },
  {
    "name": "public.clientleadtimecallcount",
    "purpose": "DidaBiz 按提前预订天数的请求量，用于 QPS × Leadtime 下钻。"
  },
  {
    "name": "public.clientloscallcount",
    "purpose": "DidaBiz 按入住晚数的请求量，用于 QPS × LOS 下钻。"
  },
  {
    "name": "public.clientnationalitycallcount",
    "purpose": "DidaBiz 按客人国籍的请求量，用于 QPS × Nationality 下钻。"
  },
  {
    "name": "public.clientsupplierhotelcallcountsummary",
    "purpose": "客户 × 供应商 × 酒店查价量和有价量汇总，以 SS 近似 CS 进行查价分析。"
  },
  {
    "name": "public.npd_booking_view",
    "purpose": "订单产量视图，用于 BKS、TTV、GP、资源等级及创建 / 离店口径分析。"
  },
  {
    "name": "public.ovs_supplier_info_v",
    "purpose": "海外供应商信息，用于按 ID、名称或 OP 识别供应商。"
  },
  {
    "name": "rateaccuracy.channel_online_hours_daily",
    "purpose": "客户 × 日期在线小时数及在线占比的可选汇总输出表；资料仅提供建表 / 填数脚本，不能视为现成源表。"
  },
  {
    "name": "rateaccuracy.channel_online_states_new",
    "purpose": "渠道上下线状态日志，用于计算在线时长和定位渠道下线。"
  }
] as const;
export const TIGER_MCP_DATA = [
  { name: "订单基本信息", purpose: "订单概况和基本信息核对，对应 query_booking_basic_info；具体字段以服务实际返回为准。" },
  { name: "订单操作日志", purpose: "追踪订单操作、状态变化和处理过程，对应 query_booking_operation_logs。" },
  { name: "订单技术日志", purpose: "排查订单接口交互和技术异常，对应 query_booking_technical_logs；具体字段以服务实际返回为准。" },
] as const;
export const DATA_MCP_CANDIDATE_DATA = "资料日期：2026-10-22。本地资料及维护人补充共 37 张候选表，不代表服务端全量或当前账号可访问清单。\n\n" + DATA_MCP_TABLES.map(table=>table.name).join("\n");
export const TIGER_MCP_CANDIDATE_DATA = "订单基本信息、订单操作日志、订单技术日志。资料未提供底层数据表名称；按工具返回的数据范围展示，不推定具体字段。";
export const MCP_INVENTORY_NOTE = "工具名称按维护人提供的清单展示；表目录按本地资料逐项核对。Data 连接重置、Tiger 初始化返回 401，尚未取得服务端完整清单或验证当前账号权限；实际可用范围以个人授权和服务返回为准。";
