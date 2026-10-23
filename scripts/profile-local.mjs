// Local-only warm request timings with an isolated temporary account.
import { createHash, randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const origin='http://127.0.0.1:5173',dir=new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/',import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec('PRAGMA busy_timeout=10000');
const id='perf-'+randomUUID(),email=id+'@example.com',key=randomBytes(24).toString('hex'),salt=randomBytes(16),now=Math.floor(Date.now()/1000),created=[];
db.prepare('INSERT INTO users (id,email,display_name,role,active,key_salt,key_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,email,'Performance QA','CREATOR',1,salt.toString('hex'),pbkdf2Sync(key,salt,100000,32,'sha256').toString('hex'),now,now);
let cookie='';const times={};
async function timed(label,route,method='GET',data){const start=performance.now();const r=await fetch(origin+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(data?{body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok)throw Error(label+': '+r.status+' '+JSON.stringify(body));if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];if(method==='POST'&&route==='/api/resources')created.push(body.id);(times[label]??=[]).push(Math.round(performance.now()-start));return body;}
try{
 await timed('login-cold','/api/auth/login','POST',{email,key});await timed('resources-cold','/api/resources');
 for(let i=0;i<5;i++){
  await timed('login','/api/auth/login','POST',{email,key});await timed('session','/api/auth/session');await timed('resources','/api/resources');await timed('refresh','/api/resources?refresh=1');
  await timed('save-website','/api/resources','POST',{type:'INTERNAL',scenario:'ai_tools',websiteCategoryId:'ai-chat',name:'Performance QA',summary:'Local test',sourceUrl:'https://example.com',slug:'perf-'+randomUUID()});
  await timed('save-resource','/api/resources','POST',{type:'SKILL',version:'1.0.0',name:'Performance QA',summary:'Local test',usageExample:'test',documentationUrl:'https://example.com/manual',contact:'QA',businessDirection:'other',installationMode:'none',slug:'perf-'+randomUUID()});
 }
 console.log(JSON.stringify({label:process.argv[2]??'timings',milliseconds:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,{samples:v,median:[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)]}]))},null,2));
}finally{for(const rid of created){db.prepare('DELETE FROM resources WHERE id=?').run(rid);db.prepare('DELETE FROM audit_logs WHERE target_id=?').run(rid);}db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);db.prepare('DELETE FROM audit_logs WHERE actor_id=?').run(id);db.prepare('DELETE FROM users WHERE id=?').run(id);db.close();}
