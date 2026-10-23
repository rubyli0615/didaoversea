type UsageResource={usageExample?:string|null;usageInstructions?:string|null;type?:string};
// Conservatively separate legacy prose from an explicit, reusable agent instruction.
export function isUsageGuide(text:string){
 return /^(?:安装完成后|提供|每天|进入对话|配置好|配置完成|Windows\s*安装说明|操作步骤|使用说明[：:]|必要输入[：:]|首先|第一步|点击|打开.{0,30}界面|以下.{0,15}(?:说明|步骤)|\d+[.、])/.test(text.trim());
}
export function resourceUsage(resource:UsageResource){
 const raw=resource.usageExample?.trim()??"",declared=resource.usageInstructions?.trim()??"";
 let command=raw,legacy="";
 const quote=/(?:^|\n)[“"]([^\n]+?)[”"](?:\n|$)/.exec(raw);
 const example=/(?:示例|使用指令示例)[：:]\s*/.exec(raw);
 if(quote){command=quote[1].trim();legacy=(raw.slice(0,quote.index)+"\n"+raw.slice(quote.index+quote[0].length)).trim();}
 else if(example){command=raw.slice(example.index+example[0].length).trim();legacy=raw.slice(0,example.index).trim();}
 else if(isUsageGuide(raw)){command="";legacy=raw;}
 if(command&&isUsageGuide(command)){legacy=[legacy,command].filter(Boolean).join("\n\n");command="";}
 return {command,instructions:[...new Set([declared,legacy].filter(Boolean))].join("\n\n")};
}
