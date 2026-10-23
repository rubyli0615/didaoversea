// A pre-export guard, not a substitute for a dedicated secret scanner.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
const paths=[...new Set(execFileSync("git",["ls-files","-z","--cached","--others","--exclude-standard"],{encoding:"utf8"}).split("\0").filter(Boolean))],failures=[];
for(const path of paths){
 if(/(?:^|\/)(?:\.env(?!\.example$)|\.dev\.vars|.*\.(?:sqlite|db|pem)$)|(?:^|\/)(?:node_modules|\.wrangler|\.sites-runtime|outputs)\//.test(path))failures.push(path+": excluded runtime file");
 if(!/\.(?:tsx?|mts|mjs|json|md|ya?ml|env|example)$/.test(path))continue;
 let source;try{source=readFileSync(path,"utf8");}catch{continue;}
 for(const [index,line] of source.split(/\r?\n/).entries())if(/sk-[a-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line))failures.push(path+":"+(index+1)+": possible literal credential");
}
if(failures.length){console.error(failures.join("\n"));process.exitCode=1;}else console.log(JSON.stringify({sourceSafetyFiles:paths.length,credentialFindings:0}));
