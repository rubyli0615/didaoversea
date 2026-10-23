import { DATA_MCP_CANDIDATE_DATA, TIGER_MCP_CANDIDATE_DATA } from "./mcp-inventory-content";

// Public setup instructions provided by the resource owner. Never insert personal keys.
export const TIGER_MCP_INSTALL = `请帮我添加或更新一个 MCP 服务（Tiger 订单日志查询，streamable HTTP，鉴权头 tiger_user_key），配置如下：

\`\`\`json
{
  "mcpServers": {
    "tiger-mcp": {
      "type": "http",
      "url": "https://tiger-api.didaadmin.com/mcp",
      "headers": {
        "tiger_user_key": "你的个人鉴权key"
      }
    }
  }
}
\`\`\``;

export const DATA_MCP_INSTALL = `{
  "mcpServers": {
    "data-mcp": {
      "name": "data-mcp",
      "type": "streamable_http",
      "url": "https://data-api-mcp.didaadmin.com/mcp/v1/query",
      "headers": {
        "agent_user_key": "你的个人鉴权Key"
      }
    }
  }
}`;

export const TIGER_MCP_TOOLS = ["tiger-mcp_query_booking_technical_logs","tiger-mcp_query_booking_basic_info","tiger-mcp_query_booking_operation_logs"];
export const DATA_MCP_TOOLS = ["data-mcp_search_meta_data","data-mcp_execute_sql","data-mcp_search_metrics","data-mcp_get_analyse_dimension_options","data-mcp_analyse_query","data-mcp_get_auto_complete"];
export const MCP_CONTENT_UPDATES = [
  { id: "mcp-tiger", installationCommand: TIGER_MCP_INSTALL, usageExample: "为我查询渠道订单号为xxxx的操作日志。", documentationUrl: "https://didatravel.feishu.cn/wiki/BU1Xw57h0iaGkek9FgncCVbTnDh", accessData: TIGER_MCP_CANDIDATE_DATA, toolList: TIGER_MCP_TOOLS, accessMethod: "Streamable HTTP；在支持 MCP 的 AI 工具中配置 tiger-mcp，并在本地填写个人 tiger_user_key。" },
  { id: "mcp-data", installationCommand: DATA_MCP_INSTALL, usageExample: "查询过去 7 天的 GP 指标，按天分组。", documentationUrl: "https://didatravel.feishu.cn/docx/QZ7wdlt0joYPuExZZovcxUNknxf", accessData: DATA_MCP_CANDIDATE_DATA, toolList: DATA_MCP_TOOLS, accessMethod: "Streamable HTTP；在支持 MCP 的 AI 工具中配置 data-mcp，并在本地填写个人 agent_user_key。" },
];
