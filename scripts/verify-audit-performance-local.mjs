// Temporary loopback fixtures only. Never reads a production credential.
import assert from "node:assert/strict";
import {createHash,randomBytes,randomUUID,pbkdf2Sync} from "node:crypto";
import {readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {chromium} from "file:///C:/Users/DIDA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const origin=process.argv[2]??"http://127.0.0.1:5173",dir=new URL("../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/",import.meta.url);
const db=new DatabaseSync(new URL(readdirSync(dir).find(n=>/^[a-f0-9]+\.sqlite$/.test(n)),dir));db.exec("PRAGMA busy_timeout=10000");
const uid="audit-"+randomUUID(),email=uid+"@example.com",key=randomBytes(24).toString("hex"),salt=randomBytes(16),now=Math.floor(Date.now()/1000),sessions=[],created=[];
db.prepare("INSERT INTO users(id,email,display_name,role,active,key_salt,key_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(uid,email,"Local Audit","CREATOR",1,salt.toString("hex"),pbkdf2Sync(key,salt,100000,32,"sha256").toString("hex"),now,now);
const browser=await chromium.launch({channel:"chrome",headless:true});let checks=0;
const check=(ok,label)=>{assert(ok,label);checks++;};
async function session(userId){const token=randomBytes(32).toString("hex"),id=randomUUID();sessions.push(id);db.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)").run(id,userId,createHash("sha256").update(token).digest("hex"),now+1800,now);const context=await browser.newContext({viewport:{width:1440,height:950}});await context.addCookies([{name:"dida_ai_session",value:token,url:origin,httpOnly:true,sameSite:"Lax"}]);return context;}
try{
 const admin=await session("usr-ruby"),creator=await session(uid),other=await session("usr-lea"),viewer=await session("usr-william");
 const call=async(context,path,method="GET",data,status=200)=>{const response=await context.request.fetch(origin+path,{method,...(data?{data}:{})});check(response.status()===status,method+" "+path+" status "+response.status());if(status===500)return;const body=await response.json();if(method==="POST"&&path==="/api/resources"&&status===201)created.push(body.id);return body;};
 const base={type:"SKILL",summary:"Local transactional and visibility QA",version:"1",contact:"QA",businessDirection:"technical_operations",installationMode:"pending",documentationUrl:"https://example.com/manual"};
 const a=await call(admin,"/api/resources","POST",{...base,name:"Public QA A",slug:"qa-"+randomUUID()},201),b=await call(admin,"/api/resources","POST",{...base,name:"Public QA B",slug:"qa-"+randomUUID()},201),hidden=await call(other,"/api/resources","POST",{...base,name:"Private QA",slug:"qa-"+randomUUID()},201);
 const secret="private-association-"+randomUUID();
 db.prepare("INSERT INTO skill_relations(id,source_skill_id,target_skill_id,trigger_condition,created_at) VALUES(?,?,?,?,?)").run(randomUUID(),a.id,hidden.id,secret,now);
 const viewerCatalog=await call(viewer,"/api/resources");check(!JSON.stringify(viewerCatalog).includes(secret)&&!viewerCatalog.resources.some(r=>r.id===hidden.id),"hidden draft and relation text excluded from catalog");
 await call(viewer,"/api/resources/"+hidden.id+"/detail","GET",undefined,404);
 await call(creator,"/api/resources/"+a.id,"PUT",{relationLinks:[{direction:"after",targetId:hidden.id,condition:"cannot inspect"}]},400);
 const links=[{direction:"after",targetId:b.id,condition:"visible branch"}];
 await call(creator,"/api/resources/"+a.id,"PUT",{relationLinks:links});
 check(db.prepare("SELECT COUNT(*) n FROM skill_relations WHERE source_skill_id=? AND target_skill_id=?").get(a.id,hidden.id).n===1,"editing preserves invisible associations without disclosing them");
 await call(creator,"/api/resources/"+a.id,"PUT",{relationLinks:[links[0],links[0]]},400);
 await call(creator,"/api/resources/"+a.id,"PUT",{releaseNote:"temporary note"});await call(creator,"/api/resources/"+a.id,"PUT",{releaseNote:""});check(db.prepare("SELECT release_note v FROM resources WHERE id=?").get(a.id).v===null,"clearing an optional field really clears it");
 const before=db.prepare("SELECT name,content_revision FROM resources WHERE id=?").get(a.id),edges=db.prepare("SELECT source_skill_id,target_skill_id,trigger_condition FROM skill_relations WHERE source_skill_id=? OR target_skill_id=? ORDER BY id").all(a.id,a.id);
 // A real table trigger affects only this unique test condition, then is removed in finally.
 const sentinel="LOCAL_ATOMIC_FAILURE_"+randomUUID().replaceAll("-","");
 db.exec("CREATE TRIGGER qa_atomic_save_failure BEFORE INSERT ON skill_relations WHEN NEW.trigger_condition='"+sentinel+"' BEGIN SELECT RAISE(ABORT,'local QA rollback'); END");
 await call(creator,"/api/resources/"+a.id,"PUT",{name:"MUST ROLL BACK",relationLinks:[{direction:"after",targetId:b.id,condition:sentinel}]},500);
 check(JSON.stringify(db.prepare("SELECT name,content_revision FROM resources WHERE id=?").get(a.id))===JSON.stringify(before),"failed association save rolls back resource content/revision");
 check(JSON.stringify(db.prepare("SELECT source_skill_id,target_skill_id,trigger_condition FROM skill_relations WHERE source_skill_id=? OR target_skill_id=? ORDER BY id").all(a.id,a.id))===JSON.stringify(edges),"failed save preserves previous association graph");
 const failedSlug="qa-rollback-"+randomUUID();await call(creator,"/api/resources","POST",{...base,name:"Failed Creation",slug:failedSlug,relationLinks:[{direction:"after",targetId:b.id,condition:sentinel}]},500);
 check(db.prepare("SELECT COUNT(*) n FROM resources WHERE slug=?").get(failedSlug).n===0,"failed creation leaves no partial resource");db.exec("DROP TRIGGER qa_atomic_save_failure");
 const usersResponse=await admin.request.get(origin+"/api/admin/users");check(usersResponse.headers()["cache-control"]==="private, no-store","admin account responses cannot be cached");check(!JSON.stringify(await usersResponse.json()).includes("keyHash"),"admin API exposes no password verifier");
 await call(admin,"/api/admin/users/does-not-exist/reset-key","POST",undefined,404);
 // Use the real login form and a synthetic account, not a mocked success response.
 const anonymous=await browser.newContext({viewport:{width:1440,height:950}}),page=await anonymous.newPage(),errors=[],calls=[];
 page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))calls.push(new URL(r.url()).pathname);});
 await page.goto(origin);await page.getByRole("button",{name:"进入工作台总览",exact:true}).waitFor();await page.waitForLoadState("networkidle");
 check(calls.length===0,"anonymous startup has no auth/catalog waterfall");
 check(await page.getByLabel("登录账号",{exact:true}).inputValue()===""&&await page.getByLabel("Access Key",{exact:true}).inputValue()==="","login starts genuinely blank");
 await page.getByLabel("登录账号",{exact:true}).fill(email);await page.getByLabel("Access Key",{exact:true}).fill(key);await page.getByRole("button",{name:"进入工作台总览",exact:true}).click();await page.locator(".workspace-shell:not([inert])").waitFor();
 check(calls.filter(p=>p==="/api/auth/login").length===1&&!calls.includes("/api/resources")&&!calls.includes("/api/auth/session"),"successful login reuses its summary without duplicate requests");
 let directoryGets=0;page.on("request",r=>{if(new URL(r.url()).pathname==="/api/website-layout"&&r.method()==="GET")directoryGets++;});
 await page.locator(".sidebar").getByRole("button",{name:"网站",exact:true}).click();await page.waitForResponse(r=>new URL(r.url()).pathname==="/api/website-layout");await page.locator(".website-overview-group").first().waitFor();
 const firstGets=directoryGets;await page.locator(".sidebar").getByRole("button",{name:"海外渠道资源",exact:true}).click();await page.getByRole("heading",{name:"海外渠道资源",exact:true}).waitFor();await page.locator(".sidebar").getByRole("button",{name:"网站",exact:true}).click();await page.locator(".website-overview-group").first().waitFor();await page.waitForTimeout(150);
 check(firstGets===1&&directoryGets===1,"switching directory/parent reuses one user-scoped request");
 check(errors.length===0,"no login/navigation runtime errors "+errors.join(";"));
 if(process.argv.includes("--test-entry-failure")){
  const failedContext=await browser.newContext(),failedPage=await failedContext.newPage();let navigations=0;
  failedPage.on("request",r=>{if(r.isNavigationRequest()&&r.resourceType()==="document")navigations++;});
  await failedPage.route("**/*workspace-app*",route=>route.request().resourceType()==="script"?route.abort("failed"):route.continue());
  await failedPage.goto(origin);await failedPage.getByLabel("登录账号",{exact:true}).fill(email);await failedPage.getByLabel("Access Key",{exact:true}).fill(key);await failedPage.getByRole("button",{name:"进入工作台总览",exact:true}).click();
  await failedPage.getByRole("heading",{name:"此页面暂时无法打开",exact:true}).waitFor();
  check(navigations===1&&await failedPage.getByRole("button",{name:"手动刷新网页",exact:true}).isVisible(),"entry chunk failure is recoverable without any automatic refresh");
  await failedPage.getByRole("button",{name:"返回登录",exact:true}).click();await failedPage.getByRole("button",{name:"进入工作台总览",exact:true}).waitFor();check(navigations===1,"failed entry can return to login without navigation");
 }
 console.log(JSON.stringify({auditPerformanceChecks:checks}));
}finally{
 db.exec("DROP TRIGGER IF EXISTS qa_atomic_save_failure;");await browser.close();
 for(const id of created){db.prepare("DELETE FROM skill_relations WHERE source_skill_id=? OR target_skill_id=?").run(id,id);db.prepare("DELETE FROM resource_reads WHERE resource_id=?").run(id);db.prepare("DELETE FROM audit_logs WHERE target_id=?").run(id);}
 for(const id of created)db.prepare("DELETE FROM resources WHERE id=?").run(id);
 for(const id of sessions)db.prepare("DELETE FROM sessions WHERE id=?").run(id);
 db.prepare("DELETE FROM sessions WHERE user_id=?").run(uid);db.prepare("DELETE FROM audit_logs WHERE actor_id=?").run(uid);db.prepare("DELETE FROM users WHERE id=?").run(uid);db.close();
}
