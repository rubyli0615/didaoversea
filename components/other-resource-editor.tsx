"use client";
import {api} from "@/lib/client-api";
import { useState, type FormEvent } from "react";
import type { ResourceView, SafeUser } from "@/lib/resource-types";

export function OtherResourceEditor({resource,resources,user,onClose,onSaved}:{resource?:ResourceView;resources:ResourceView[];user:SafeUser;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const categories=[...new Set(resources.filter(item=>item.type==="OTHER").map(item=>item.scenario).filter(Boolean))];
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    const form=new FormData(event.currentTarget),detail=String(form.get("detail")??"").trim();
    const publish=(event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement && ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).name==="publish";
    try{
      await api(resource?`/api/resources/${resource.id}`:"/api/resources",{method:resource?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        type:"OTHER",resourceModule:"other",slug:resource?.slug??`other-${crypto.randomUUID()}`,scenario:form.get("scenario"),name:form.get("name"),sourceUrl:form.get("sourceUrl"),detail,summary:detail.slice(0,200),installationMode:"none",...(publish?{status:"PUBLISHED"}:{})
      })});
      await onSaved();
    }catch(error){setError(error instanceof Error?error.message:"保存失败");setBusy(false);}
  }
  return <div className="resource-editor-page other-resource-editor"><div className="editor-heading"><h1>{resource?"编辑其他资源":"创建其他资源"}</h1><p>收录不属于 Skill、MCP、Agent 或网站目录的实用内容。</p></div>
    <form className="resource-editor-form" onSubmit={submit}><section className="form-section"><div className="form-grid">
      <label>类别 *<input name="scenario" list="other-resource-categories" defaultValue={resource?.scenario??""} maxLength={40} placeholder="例如：模板、规范、学习资料" required/><datalist id="other-resource-categories">{categories.map(category=><option key={category} value={category!}/>)}</datalist></label>
      <label>名称 *<input name="name" defaultValue={resource?.name} maxLength={150} required/></label>
      <label className="full">链接 *<input name="sourceUrl" type="url" defaultValue={resource?.sourceUrl??""} maxLength={2048} placeholder="https://..." required/></label>
      <label className="full">使用说明 *<textarea name="detail" defaultValue={resource?.detail??""} rows={8} maxLength={20000} placeholder="说明内容用途、使用步骤和注意事项。" required/></label>
    </div></section>{error&&<div className="form-error" role="alert">{error}</div>}<footer className="editor-footer">{resource?.status==="DRAFT"&&user.role==="ADMIN"&&<button className="primary-button" name="publish" disabled={busy}>发布资源</button>}<button type="button" className="secondary-button" disabled={busy} onClick={onClose}>取消</button><button className="primary-button" disabled={busy}>{busy?"保存中…":resource?"保存修改":"保存资源"}</button></footer></form>
  </div>;
}
