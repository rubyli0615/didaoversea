// Conservative cleanup: only earlier identical declarations under the same conditions.
// Emits an apply_patch payload, never writes the source itself.
import { readFileSync } from "node:fs";
import postcss from "postcss";
const paths=["app/globals.css","app/resource-experience.css","app/workspace-updates.css"];
const files=paths.map(path=>({path,before:readFileSync(path,"utf8").replaceAll("\r\n","\n")}));
const seen=new Set();let removed=0;
for(const file of [...files].reverse()){
 const root=postcss.parse(file.before),declarations=[];root.walkDecls(decl=>declarations.push(decl));
 for(const decl of declarations.reverse()){
  if(decl.parent.type!=="rule")continue;
  const context=[];let parent=decl.parent.parent,keyframe=false;
  while(parent&&parent.type!=="root"){if(parent.type==="atrule"){if(parent.name.includes("keyframes"))keyframe=true;context.unshift(parent.name+" "+parent.params);}parent=parent.parent;}
  if(keyframe)continue;
  const key=JSON.stringify([context,decl.parent.selector,decl.prop,decl.value,Boolean(decl.important)]);
  if(seen.has(key)){decl.remove();removed++;}else seen.add(key);
 }
 file.after=root.toString().trimEnd()+"\n";
}
const patch="*** Begin Patch\n"+files.map(file=>"*** Update File: D:\\ai-capability-hub\\"+file.path.replaceAll("/","\\")+"\n@@\n"+file.before.trimEnd().split("\n").map(line=>"-"+line).join("\n")+"\n"+file.after.trimEnd().split("\n").map(line=>"+"+line).join("\n")+"\n").join("")+"*** End Patch";
console.log(JSON.stringify({removed,before:files.reduce((n,f)=>n+Buffer.byteLength(f.before),0),after:files.reduce((n,f)=>n+Buffer.byteLength(f.after),0),patch}));
