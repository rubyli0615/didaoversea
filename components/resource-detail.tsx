"use client";

import {api} from "@/lib/client-api";
import { resourceUsage } from "@/lib/resource-usage";
import { mcpToolRows, mcpDataRows, mcpDataNote } from "@/lib/mcp-presentation";
import { canEditResource } from "@/lib/resource-modules";
import { CommandBlock } from "@/components/command-block";
import { SkillAnalysis } from "@/components/skill-analysis";
import { McpConnection } from "@/components/mcp-connection";
import { useState } from "react";
import { ArrowRight, BookOpen, Boxes, ExternalLink, GitBranch, Pencil, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { SKILL_CATEGORIES, contactLabel, type ResourceView, type SafeUser, type SkillRelationView } from "@/lib/resource-types";

export function ResourceDetail({ resource, resources, relations, user, onSelect, onEdit, onDeleted }: { resource: ResourceView; resources: ResourceView[]; relations: SkillRelationView[]; user: SafeUser; onSelect: (resource: ResourceView) => void; onEdit: () => void; onDeleted: () => void | Promise<void> }) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canEdit = canEditResource(user, resource);
  const canDelete = user.role === "ADMIN" || (user.role === "CREATOR" && resource.ownerId === user.id);
  const incoming = relations.filter((item) => item.targetSkillId === resource.id);
  const outgoing = relations.filter((item) => item.sourceSkillId === resource.id);
  const Icon = resource.type === "SKILL" ? GitBranch : resource.type === "MCP" ? Boxes : Sparkles;
  const usage=resourceUsage(resource);
  const hasPrerequisites = Boolean(resource.repositoryAccess !== "none" || resource.repositoryInstructions || resource.mcpRequirements || resource.dataPermissions.length);
  async function remove() {
    if (!confirm(`确定删除“${resource.name}”？资源会从列表移除，记录仍可由管理员恢复。`)) return;
    setDeleting(true); setError("");
    try {
      await api(`/api/resources/${resource.id}`, { method: "DELETE" });
      await onDeleted();
    } catch (err) { setError(err instanceof Error ? err.message : "删除失败"); setDeleting(false); }
  }
  const related = (items: SkillRelationView[], direction: "before" | "after") => items.map((relation) => {
    const item = resources.find((candidate) => candidate.id === (direction === "before" ? relation.sourceSkillId : relation.targetSkillId));
    return item ? <button className="related-resource" key={relation.id} onClick={() => onSelect(item)}><b>{item.name}</b><p>{relation.triggerCondition}</p><ArrowRight size={16} /></button> : null;
  });
  if(resource.type === "OTHER") return <article className="resource-page continuous-detail other-resource-detail"><header className="resource-page-hero"><div className="detail-badges"><span className="type-badge blue">其他资源</span><span className="soft-badge">{resource.scenario}</span></div><span className="resource-icon big blue"><BookOpen size={24}/></span><h1>{resource.name}</h1></header>{error&&<p className="form-error" role="alert">{error}</p>}<div className="resource-page-layout"><main><section className="resource-content-card"><h2>使用说明</h2><p className="detail-copy">{resource.detail}</p></section></main><aside className="resource-side"><section><h2>使用资源</h2>{resource.sourceUrl&&<a className="side-action" href={resource.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>打开资源链接</a>}{canEdit&&<div className="resource-management"><button className="side-edit" onClick={onEdit}><Pencil size={15}/>编辑资源</button>{canDelete&&<button className="side-delete" disabled={deleting} onClick={remove}><Trash2 size={15}/>删除资源</button>}</div>}</section></aside></div></article>;
  return <article className="resource-page continuous-detail">
    <header className="resource-page-hero">
      <div className="detail-badges"><span className={`type-badge ${resource.type === "AGENT" ? "blue" : "coral"}`}>{resource.type === "SKILL" ? "Skill" : resource.type === "MCP" ? "MCP" : "Agent"}</span>{resource.businessDirection && <span className="soft-badge">{SKILL_CATEGORIES.find((item) => item.id === resource.businessDirection)?.label}</span>}{resource.version?.trim() && <span className="soft-badge">v{resource.version}</span>}</div>
      <span className={`resource-icon big ${resource.type === "AGENT" ? "blue" : "coral"}`} aria-hidden="true"><Icon size={24} /></span>
      <h1>{resource.name}</h1>
      <p>{resource.summary}</p>
    </header>
    {resource.status === "DRAFT" && <p className="draft-detail-notice" role="status">草稿 · 仅创建者和管理员可见，发布后才会通知团队。</p>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="resource-page-layout"><main>
      {resource.type === "MCP" ? <McpContent resource={resource} /> : <section className="resource-content-card"><h2>资源介绍</h2>{resource.type==="SKILL"&&resource.scenario&&resource.scenario!==SKILL_CATEGORIES.find(item=>item.id===resource.businessDirection)?.label&&<div className="overview-part"><h3>使用场景</h3><p>{resource.scenario}</p></div>}{resource.implementation && <div className="overview-part"><h3>实现方式</h3><p>{resource.implementation}</p></div>}{resource.detail && <div className="overview-part"><h3>适用说明</h3><p>{resource.detail}</p></div>}{!resource.implementation && !resource.detail && <p className="detail-copy">{resource.summary}</p>}{resource.type === "AGENT" && resource.knowledgeScope && <div className="overview-part"><h3>知识范围</h3><p>{resource.knowledgeScope}</p></div>}</section>}
      {resource.type === "SKILL" && hasPrerequisites && <section className="resource-content-card prerequisites"><h2>安装前准备</h2>
        {resource.repositoryAccess !== "none" && <div className="prerequisite-item"><h3>GitHub 仓库权限 <span className={`access-badge ${resource.repositoryAccess}`}>{resource.repositoryAccess === "private" ? "私有 · 先申请" : "公开 · 无需邀请"}</span></h3>{resource.repositoryInstructions ? <p>{resource.repositoryInstructions}</p> : <p>公开仓库，无需登录即可 clone。</p>}</div>}
        {resource.mcpRequirements && <div className="prerequisite-item"><h3>MCP / API 与数据权限</h3><p>{resource.mcpRequirements}</p>{!!resource.dataPermissions.length && <TableApproval />}</div>}
        {!!resource.dataPermissions.length && <details className="permission-disclosure" open><summary>所需数据表 <span>{resource.dataPermissions.length} 项 · 只读 SELECT</span></summary><div className="permission-table-scroll"><table className="permission-table"><thead><tr><th>优先级 / 用途</th><th>数据表</th><th>作用或缺失影响</th></tr></thead><tbody>{resource.dataPermissions.map((row, index) => <tr key={`${row.table}-${index}`}><td><span className={`priority-badge ${row.priority.startsWith("P0") || row.priority.includes("重点") ? "essential" : ""}`}>{row.priority}</span></td><td><code>{row.table}</code></td><td>{row.purpose}</td></tr>)}</tbody></table></div></details>}
        {!!resource.dataPermissions.length && <div className="table-application-reason"><h3>表权限申请原因参考</h3><p>如要申请上述表，申请原因可填：</p><CommandBlock variant="text" label="申请原因" copyLabel="复制申请原因" className="application-reason-code" text={resource.tablePermissionReason?.trim() || `需要通过本人 data_mcp 只读访问上述数据表，用于${resource.name}：${resource.summary}。仅限本职业务分析，不修改源数据；申请范围以实际业务需要及审批结果为准。`} />{!resource.mcpRequirements && <TableApproval />}</div>}
      </section>}
      {resource.type === "SKILL" && <section className="resource-content-card"><h2>{resource.installationMode==="pending"?"安装说明":"安装指令"}</h2>{resource.installationMode === "none" && <div className="installation-status">无需个人安装 · 团队统一运行</div>}{resource.installationCommand ? resource.installationMode==="pending"?<p className="detail-copy installation-guide">{resource.installationCommand}</p>:<CommandBlock text={resource.installationCommand} label="安装指令" copyLabel="复制安装指令" className="installation-instructions" /> : <p className="detail-copy">安装方式待发布方补充，请联系 {contactLabel(resource.contact, resource.ownerName)}。</p>}<div className="security-note"><ShieldCheck size={16} /><span>个人密钥只在本地配置，不上传至工作台。</span></div></section>}
      {resource.type !== "MCP" && <section className="resource-content-card"><h2>如何使用</h2>{usage.instructions&&<div className="usage-guidance"><h3>使用说明</h3><p className="detail-copy">{usage.instructions}</p></div>}{resource.slug==="attribution-analysis"?<SkillAnalysis resourceId={resource.id}/>:usage.command?<><h3 className="usage-command-label">使用指令示例</h3><CommandBlock text={usage.command} label="使用指令" copyLabel="复制使用指令"/></>:!usage.instructions&&<p className="detail-copy">暂无使用说明，请查看右侧使用文档。</p>}</section>}

      {resource.type !== "MCP" && !!resource.commonQa?.length && <section className="resource-content-card resource-faq"><h2>常见 Q&A</h2>{resource.commonQa.map((item,index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
      {resource.type === "SKILL" && <section className="resource-content-card"><h2>Skill 关联</h2><div className="skill-relation-chain"><div className="relation-stage"><h3>推荐前置</h3>{incoming.length ? related(incoming, "before") : <div className="relation-empty">无推荐前置</div>}</div><div className="relation-stage current-stage"><h3>当前 Skill</h3><div className="relation-current"><GitBranch size={22} /><b>{resource.name}</b><span>你正在查看</span></div></div><div className="relation-stage"><h3>推荐后续</h3>{outgoing.length ? related(outgoing, "after") : <div className="relation-empty">无推荐后续</div>}</div></div></section>}
    </main><aside className="resource-side"><section><h2>{resource.type==="AGENT"?"开始使用":"资源信息"}</h2>
      {resource.sourceUrl && resource.type !== "MCP" ? <a className="side-action" href={resource.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />{resource.type === "AGENT" ? "打开 Agent" : "访问 GitHub / 资源"}</a> : resource.type === "AGENT" && <button className="side-action" disabled>Agent 链接待补充</button>}
      <ResourceDocuments resource={resource}/>
      <dl><div><dt>联系人</dt><dd>{contactLabel(resource.contact, resource.ownerName)}</dd></div>{resource.version?.trim() && <div><dt>版本</dt><dd>{resource.version}</dd></div>}<div><dt>最近更新</dt><dd>{new Date(resource.updatedAt * 1000).toLocaleDateString("zh-CN")}</dd></div></dl>
      {canEdit && <div className="resource-management"><button className="side-edit" onClick={onEdit}><Pencil size={15} />编辑资源</button>{canDelete && <button className="side-delete" disabled={deleting} onClick={remove}><Trash2 size={15} />{deleting ? "删除中…" : "删除资源"}</button>}</div>}
    </section></aside></div>
  </article>;
}

function TableApproval() {
  return <div className="table-approval"><h4>如何申请数据表权限</h4><p>以下步骤适用于通过 data_mcp 查询表；API Key / LicenseKey 的申请仍按上方接入说明办理。</p><ol><li>打开飞书【审批】→【数据权限&amp;导出申请】。</li><li>申请类型选择“数据权限”，申请数据表选择“指定表”，添加实际所需表名称及申请原因。</li><li>审批通过后，可在本人已获授权的范围内通过 data_mcp 只读访问；如仍无权限，请核对审批表名与个人账号。</li></ol><p>Bookable Hotel 数据已注册为元数据 <code>data_ovs.weekly_bookable_hotel</code>，有需要时可另行申请，不是每个 Skill 的必选表。</p></div>;
}

function McpContent({ resource }: { resource: ResourceView }) {
  const tools = mcpToolRows(resource), data = mcpDataRows(resource), description = mcpDataNote(resource);
  return <>
    <McpConnection key={resource.id} resource={resource}/>
    <section className="resource-content-card mcp-tools-section"><details className="permission-disclosure" open><summary>工具清单 <span>{resource.toolList.length} 项</span></summary><div className="permission-table-scroll"><table className="permission-table"><thead><tr><th>工具名称</th><th>功能说明</th></tr></thead><tbody>{tools.map(tool => <tr key={tool.name}><td><code>{tool.name}</code></td><td>{tool.purpose || "维护人尚未提供功能说明。"}</td></tr>)}</tbody></table></div>{!resource.toolList.length && <p className="detail-copy">工具清单待补充。</p>}</details></section>
    <section className="resource-content-card mcp-data-section"><details className="permission-disclosure" open><summary>可访问数据 <span>{data.length} 项</span></summary>{description && <p className="detail-copy">{description}</p>}<div className="permission-table-scroll"><table className="permission-table"><thead><tr><th>{resource.slug === "tiger-mcp" ? "数据范围" : "数据表"}</th><th>说明 / 作用</th></tr></thead><tbody>{data.map(row => <tr key={row.name}><td><code>{row.name}</code></td><td>{row.purpose}</td></tr>)}</tbody></table></div>{!data.length && <p className="detail-copy">数据范围待补充，请联系维护人。</p>}</details></section>
  </>;
}
function ResourceDocuments({resource}:{resource:ResourceView}) {
  return <div className="resource-documents side-documents">{resource.type === "AGENT" && (resource.referenceUrl || resource.documentationUrl) && <a className="side-action agent-reference" href={resource.referenceUrl || resource.documentationUrl || undefined} target="_blank" rel="noopener noreferrer"><BookOpen size={15} />查看使用文档</a>}{resource.type !== "AGENT" && resource.documentationUrl && <a className="side-action" href={resource.documentationUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={15} />查看使用文档</a>}{resource.caseUrl && <a className="side-action case-link" href={resource.caseUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />查看输出文档示例</a>}{resource.type === "SKILL" && resource.referenceUrl && <a className="side-action" href={resource.referenceUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={15} />查看补充文档</a>}</div>;
}

