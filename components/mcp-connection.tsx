"use client";
import { CommandBlock } from "./command-block";
import type { ResourceView } from "@/lib/resource-types";
export function McpConnection({resource}:{resource:ResourceView}) {
  return <section className="resource-content-card mcp-connection-section"><h2>接入方式</h2><p className="detail-copy">{resource.accessMethod||"待发布方补充"}</p>
    {resource.installationCommand&&(resource.installationMode==="pending"?<p className="detail-copy installation-guide">{resource.installationCommand}</p>:<CommandBlock text={resource.installationCommand} label="安装指令" copyLabel="复制安装指令" className="installation-instructions"/>)}
  </section>;
}
