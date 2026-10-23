"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export function CommandBlock({text,copyText=text,label,copyLabel,className="",variant="command",children,errorText=variant==="text"?"复制失败，请选中文字手动复制。":"复制失败，请选中代码框内的指令手动复制。"}:{variant?:"command"|"text";children?:ReactNode;text:string;copyText?:string;label:string;copyLabel:string;className?:string;errorText?:string}) {
  const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{setCopied(false);setFailed(false);},[copyText]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  async function copy(){
    try{await navigator.clipboard.writeText(copyText);setCopied(true);setFailed(false);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),1800);}
    catch{setFailed(true);}
  }
  return <div className={`command-block ${className}`}><div className="usage-code"><div className="usage-code-toolbar"><span>{label}</span><button type="button" className="copy-usage" aria-label={copyLabel} onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"已复制":"复制"}</button></div><div className={variant==="text"?"copyable-text":undefined}>{variant==="text"?<p>{text}</p>:<pre className={className.includes("installation-instructions")?"installation-code":undefined}><code>{children??text}</code></pre>}</div></div>{failed&&<p className="copy-error" role="status">{errorText}</p>}</div>;
}
