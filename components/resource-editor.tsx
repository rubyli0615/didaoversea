"use client";

import {api} from "@/lib/client-api";
import { resourceUsage } from "@/lib/resource-usage";
import { getResourceModule, RESOURCE_MODULES, type ResourceModule } from "@/lib/resource-modules";
import { mcpToolRows, mcpDataRows, mcpDataNote } from "@/lib/mcp-presentation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SKILL_CATEGORIES, contactLabel, type CommonQa, type DataPermission, type ResourceType, type ResourceView, type SafeUser, type SkillRelationView } from "@/lib/resource-types";
import type { RelationInput } from "@/lib/resource-input";

export function ResourceEditor({ resource, resources, relations, user, defaultModule = "overseas", defaultType = "SKILL", onClose, onSaved }: { resource?: ResourceView; defaultModule?: ResourceModule; defaultType?: "SKILL" | "MCP" | "AGENT"; resources: ResourceView[]; relations: SkillRelationView[]; user: SafeUser; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [type, setType] = useState<ResourceType>(resource?.type ?? defaultType);
  const [mode, setMode] = useState(resource?.installationMode ?? "required");
  const [repoAccess, setRepoAccess] = useState(resource?.repositoryAccess ?? "none");
  const [permissions, setPermissions] = useState<DataPermission[]>(resource?.dataPermissions ?? []);
  const [commonQa, setCommonQa] = useState<CommonQa[]>(resource?.commonQa ?? []);
  const [links, setLinks] = useState<RelationInput[]>(() => resource ? relations.filter((item) => item.sourceSkillId === resource.id || item.targetSkillId === resource.id).map((item) => ({ direction: item.targetSkillId === resource.id ? "before" : "after", targetId: item.targetSkillId === resource.id ? item.sourceSkillId : item.targetSkillId, condition: item.triggerCondition })) : []);
  const [tools, setTools] = useState(() => mcpToolRows(resource));
  const [mcpData, setMcpData] = useState(() => mcpDataRows(resource));
  const errorRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const usage=resourceUsage(resource??{});
  const skills = resources.filter((item) => item.type === "SKILL" && item.id !== resource?.id);
  const installable = type === "SKILL" || type === "MCP";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name === "publish") payload.status = "PUBLISHED";
    try {
      await api(resource ? `/api/resources/${resource.id}` : "/api/resources", { method: resource ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...payload, type, ...(type !== "MCP" ? {commonQa} : {}),
        slug: resource?.slug ?? (payload.slug?.trim() || `resource-${crypto.randomUUID()}`),
        installationMode: installable ? mode : "none", ...(type === "SKILL" ? {repositoryAccess: repoAccess} : {}),
        ...(type === "SKILL" ? {repositoryInstructions: repoAccess === "private" ? payload.repositoryInstructions : ""} : {}),
        relationLinks: type === "SKILL" ? links : undefined,
        ...(type === "SKILL" ? {dataPermissions: permissions.filter(row => row.table.trim()).map(row => ({priority:row.priority.trim(),table:row.table.trim(),purpose:row.purpose.trim()}))} : type === "MCP" ? {dataPermissions:mcpData.map(row=>({priority:"数据范围",table:row.name.trim(),purpose:row.purpose.trim()})),toolList:tools.map(row=>row.name.trim()),toolDescriptions:Object.fromEntries(tools.map(row=>[row.name.trim(),row.purpose.trim()]))} : {}),
      }) });
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); setBusy(false); }
  }
  const updatePermission = (index: number, field: keyof DataPermission, value: string) => setPermissions((rows) => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  return <div className="resource-editor-page">
    <div className="editor-heading"><h1>{resource ? "编辑资源" : "发布资源"}</h1>{!resource && user.role === "CREATOR" && <p>保存为草稿，管理员发布后团队可见。</p>}<p>* 为必填。只填写当前类型实际展示的信息，链接和指令中不要包含个人密钥。</p></div>
    <form className="resource-editor-form" autoComplete="off" onSubmit={submit}>
      <section className="form-section"><h2>基本信息</h2><div className="form-grid">
        <label>所属模块<select name="resourceModule" defaultValue={resource ? getResourceModule(resource) : defaultModule}>{Object.entries(RESOURCE_MODULES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {!resource && <label>资源类型<select aria-label="资源类型" value={type} onChange={(event) => setType(event.target.value as ResourceType)}><option value="SKILL">Skill</option><option value="MCP">MCP</option><option value="AGENT">Agent</option></select></label>}
        <label className="full">名称 *<input name="name" defaultValue={resource?.name} required maxLength={150} placeholder="用同事能理解的名称描述能力" /></label>
        <label className="full">{type === "SKILL" ? "痛点 + 解决的问题" : "简介"} *<textarea name="summary" required rows={3} defaultValue={resource?.summary} placeholder="谁遇到了什么困难？这项资源能解决什么问题？" /></label>
        {type === "SKILL" ? <label>分类 *<select name="businessDirection" required defaultValue={resource?.businessDirection ?? ""}><option value="" disabled>请选择分类</option>{SKILL_CATEGORIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label> : null}
{type==="SKILL"&&<label>使用场景（选填）<input name="scenario" maxLength={500} defaultValue={resource?.scenario??""} placeholder="例如：酒店静态数据查询" /></label>}<label>联系人{type === "SKILL" && " *"}<input name="contact" required={type === "SKILL"} defaultValue={resource?contactLabel(resource.contact,resource.ownerName):""} placeholder={`例如：${user.displayName}，或实际维护人姓名`} /></label>
      </div>
      <div className="editor-version"><h3>版本信息</h3><div className="form-grid"><label>版本 *<input key={`version-${type}`} name="version" required maxLength={50} defaultValue={resource?.version ?? ""} placeholder="例如：1.0.0" /></label><label>更新说明（本次改了什么）<input name="releaseNote" defaultValue={resource?.releaseNote ?? ""} placeholder="例如：增加权限自测步骤" /></label></div></div>
      </section>
      {type === "SKILL" && <section className="form-section"><h2>安装前准备</h2><p className="field-description">提前说明需要申请的权限。没有前置条件时可留空。</p>
        <div className="form-grid"><label>GitHub / 资源链接<input name="sourceUrl" type="url" defaultValue={resource?.sourceUrl ?? ""} placeholder="https://github.com/..." /></label><label>仓库访问权限<select value={repoAccess} onChange={(event) => setRepoAccess(event.target.value)}><option value="none">不涉及仓库</option><option value="public">公开仓库</option><option value="private">私有仓库，需要申请</option></select></label></div>
        {repoAccess === "private" && <label>仓库权限申请步骤 *<textarea name="repositoryInstructions" required rows={4} defaultValue={resource?.repositoryInstructions ?? ""} placeholder="向谁提供 GitHub 用户名，如何接受邀请、使用哪个账号登录？" /></label>}
        <label>MCP / API 接入与数据权限申请说明<textarea name="mcpRequirements" rows={4} defaultValue={resource?.mcpRequirements ?? ""} placeholder="例如：先配置自己的 user-data-mcp；向谁申请实际账号的 SELECT 权限，如何完成权限自测。不要填写密钥。" /></label>
        <div className="permission-editor"><header><b>所需数据表</b><button type="button" className="small-button" onClick={() => setPermissions((rows) => [...rows, { priority: "", table: "", purpose: "" }])}><Plus size={14} />添加一项</button></header>
          {permissions.map((row, index) => <div className="permission-editor-row" key={index}><input aria-label={`第 ${index + 1} 项优先级`} placeholder="例如：P0 / 必需" value={row.priority} onChange={(event) => updatePermission(index, "priority", event.target.value)} /><input aria-label={`第 ${index + 1} 项数据表`} placeholder="schema.table" value={row.table} required onChange={(event) => updatePermission(index, "table", event.target.value)} /><input aria-label={`第 ${index + 1} 项用途`} placeholder="用途 / 缺失影响" value={row.purpose} onChange={(event) => updatePermission(index, "purpose", event.target.value)} /><button type="button" className="icon-button" aria-label={`移除第 ${index + 1} 项`} onClick={() => setPermissions((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}
        </div>
        {!!permissions.length && <label>表权限申请原因参考（选填）<textarea name="tablePermissionReason" rows={4} maxLength={4000} defaultValue={resource?.tablePermissionReason??""} placeholder="说明申请这些表的业务目的、使用范围及只读用途；留空时详情页显示通用参考文案。"/></label>}
      </section>}
      {type === "MCP" && <section className="form-section"><h2>接入方式</h2><label>接入说明 *<textarea name="accessMethod" required rows={3} defaultValue={resource?.accessMethod ?? ""} placeholder="例如：Streamable HTTP，在本地配置个人鉴权 Key。" /></label><label>使用文档链接（选填）<input name="documentationUrl" type="url" defaultValue={resource?.documentationUrl ?? ""} placeholder="https://..." /></label></section>}
      {installable && <section className="form-section"><h2>安装指令</h2><label>安装方式<select aria-label="安装方式" value={mode} onChange={(event) => setMode(event.target.value)}><option value="required">需要安装，有安装指令</option><option value="none">无需个人安装 / 统一运行</option><option value="pending">其他</option></select></label><label>{mode === "required" ? "完整安装指令 *" : "安装方式说明（可选）"}<textarea name="installationCommand" required={mode === "required"} rows={8} defaultValue={resource?.installationCommand ?? ""} placeholder={mode==="required"?"填写可直接复制给 Agent 的完整安装指令，不填写个人密钥。":"填写安装步骤、准备事项或其他说明；详情页会按普通文字展示。"} /></label></section>}
      {type === "SKILL" && <section className="form-section"><h2>使用方法</h2>
        <label>使用说明（选填）<textarea name="usageInstructions" defaultValue={usage.instructions} rows={4} placeholder="填写准备事项、操作步骤和注意事项；这段内容不放在指令复制框中。"/></label>
        <label>使用指令示例（选填）<textarea name="usageExample" defaultValue={usage.command} rows={4} placeholder="例如：使用 attribution-analysis，分析【ClientID】在【日期】的产量变化。只填写直接给 Agent 的指令；没有可留空。"/></label>
        <div className="document-link-fields"><label>使用文档链接（必填）<input name="documentationUrl" type="url" required defaultValue={resource?.documentationUrl??""} placeholder="https://..."/></label><label>输出文档链接（选填）<input name="caseUrl" type="url" defaultValue={resource?.caseUrl??""} placeholder="https://..."/></label><label>补充使用文档链接（选填）<input name="referenceUrl" type="url" defaultValue={resource?.referenceUrl??""} placeholder="https://..."/></label></div>
        <label>补充介绍<textarea name="detail" rows={3} defaultValue={resource?.detail ?? ""} placeholder="适用边界、注意事项等" /></label>
      </section>
      }
      {type === "AGENT" && <section className="form-section"><h2>Agent 使用信息</h2><label>访问链接 *<input name="sourceUrl" required type="url" defaultValue={resource?.sourceUrl ?? ""} placeholder="https://..." /></label><label>适用说明 *<textarea name="detail" required rows={3} defaultValue={resource?.detail ?? ""} placeholder="说明适合哪些人、哪些问题，避免重复填写简介。" /></label><label>知识范围（选填）<input name="knowledgeScope" defaultValue={resource?.knowledgeScope ?? ""} placeholder="例如：海外线上渠道私有知识库" /></label><label>如何使用 *<textarea name="usageInstructions" required rows={3} defaultValue={usage.instructions} placeholder="例如：进入对话界面开启对话即可。"/></label><label>使用指令示例（选填）<textarea name="usageExample" rows={3} defaultValue={usage.command} placeholder="填写可直接发送给 Agent 的示例；没有可留空。"/></label><label>使用文档链接（选填）<input name="referenceUrl" type="url" defaultValue={resource?.referenceUrl ?? resource?.documentationUrl ?? ""} placeholder="https://..." /></label></section>}
      {type !== "MCP" && <section className="form-section faq-editor"><h2>常见 Q&A</h2><p className="field-description">选填。记录常见问题、排查方式和使用边界，展示在“如何使用”之后。</p>
        {commonQa.map((item,index) => <div className="faq-editor-row" key={index}><label>问题 {index+1}<input required maxLength={300} aria-label={`第 ${index+1} 个问题`} value={item.question} placeholder="例如：为什么查询不到数据？" onChange={event => setCommonQa(rows => rows.map((row,i) => i===index ? {...row,question:event.target.value} : row))} /></label><label>回答<textarea required maxLength={8000} rows={3} aria-label={`第 ${index+1} 个回答`} value={item.answer} placeholder="说明原因、解决步骤或联系人。" onChange={event => setCommonQa(rows => rows.map((row,i) => i===index ? {...row,answer:event.target.value} : row))} /></label><button type="button" className="icon-button" aria-label={`移除第 ${index+1} 个问答`} onClick={() => setCommonQa(rows => rows.filter((_,i) => i!==index))}><Trash2 size={15} /></button></div>)}
        <button type="button" className="small-button" disabled={commonQa.length>=30} onClick={() => setCommonQa(rows => [...rows,{question:"",answer:""}])}><Plus size={14} />添加问答</button>
      </section>
      }
      {type === "SKILL" && <section className="form-section"><h2>Skill 关联</h2><p className="field-description">可添加多项前置或后续关联，没有明确衔接关系时留空。“使用时机”说明何时衔接该 Skill，例如：发现 BRG 配置变化后，继续用 L2L Skill 核验。</p>{links.map((link, index) => <div className="relation-editor-row" key={index}><label>关系<select value={link.direction} onChange={(event) => setLinks((rows) => rows.map((row, i) => i === index ? { ...row, direction: event.target.value as "before" | "after" } : row))}><option value="before">推荐前置</option><option value="after">推荐后续</option></select></label><label>关联 Skill<select required value={link.targetId} onChange={(event) => setLinks((rows) => rows.map((row, i) => i === index ? { ...row, targetId: event.target.value } : row))}><option value="">请选择</option>{skills.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>使用时机<input placeholder="何时使用这个关联 Skill？" value={link.condition} onChange={(event) => setLinks((rows) => rows.map((row, i) => i === index ? { ...row, condition: event.target.value } : row))} /></label><button type="button" className="icon-button" aria-label={`移除第 ${index + 1} 项关联`} onClick={() => setLinks((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}<button type="button" className="small-button" onClick={() => setLinks((rows) => [...rows, { direction: "after", targetId: "", condition: "" }])}><Plus size={14} />添加关联</button></section>}

      {type === "MCP" && <section className="form-section mcp-row-editor"><h2>工具清单</h2><p className="field-description">逐项填写工具名称与功能说明，保存后按相同的两列表格展示。未确认时可暂不添加。</p>{tools.map((row,index)=><div className="mcp-editor-row" key={index}><label>工具名称 *<textarea rows={2} aria-label={`工具 ${index+1} 名称`} required maxLength={200} value={row.name} onChange={event=>setTools(current=>current.map((item,i)=>i===index?{...item,name:event.target.value}:item))}/></label><label>功能说明 *<textarea aria-label={`工具 ${index+1} 功能说明`} required maxLength={2000} rows={2} value={row.purpose} onChange={event=>setTools(current=>current.map((item,i)=>i===index?{...item,purpose:event.target.value}:item))}/></label><button type="button" className="icon-button" aria-label={`移除工具 ${index+1}`} onClick={()=>setTools(current=>current.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div>)}<button type="button" className="small-button" disabled={tools.length>=100} onClick={()=>setTools(current=>[...current,{name:"",purpose:""}])}><Plus size={14}/>添加工具</button></section>}
      {type === "MCP" && <section className="form-section mcp-row-editor"><h2>可访问数据</h2><p className="field-description">填写实际提供的数据表或数据范围及作用。不确定的权限请在补充说明中注明。</p>{mcpData.map((row,index)=><div className="mcp-editor-row" key={index}><label>数据表 / 数据范围 *<textarea rows={2} aria-label={`数据 ${index+1} 名称`} required maxLength={300} value={row.name} onChange={event=>setMcpData(current=>current.map((item,i)=>i===index?{...item,name:event.target.value}:item))}/></label><label>说明 / 作用 *<textarea aria-label={`数据 ${index+1} 作用`} required maxLength={2000} rows={2} value={row.purpose} onChange={event=>setMcpData(current=>current.map((item,i)=>i===index?{...item,purpose:event.target.value}:item))}/></label><button type="button" className="icon-button" aria-label={`移除数据 ${index+1}`} onClick={()=>setMcpData(current=>current.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div>)}<button type="button" className="small-button" disabled={mcpData.length>=100} onClick={()=>setMcpData(current=>[...current,{name:"",purpose:""}])}><Plus size={14}/>添加数据范围</button><label>数据范围补充说明（选填）<textarea name="accessData" rows={3} defaultValue={mcpDataNote(resource)} /></label></section>}

      {error && <div className="form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}<footer className="editor-footer">{resource?.status === "DRAFT" && user.role === "ADMIN" && <button type="submit" name="publish" value="PUBLISHED" className="primary-button" disabled={busy}>发布并通知团队</button>}<button type="button" className="secondary-button" onClick={onClose} disabled={busy}>取消</button><button className="primary-button" disabled={busy}>{busy ? "保存中…" : resource ? "保存修改" : "保存资源"}</button></footer>
    </form>
  </div>;
}
