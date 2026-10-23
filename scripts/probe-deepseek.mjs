// Reads the credential through non-echoing stdin, never argv, files, logs or stdout.
let value="";
process.stdin.setRawMode?.(true);process.stdin.setEncoding("utf8");
process.stderr.write("Ready for private API probe input (hidden).\n");
const payload=await new Promise((resolve,reject)=>{
 const onData=chunk=>{value+=chunk;if(value.includes("\u0003"))reject(Error("Cancelled"));else if(/[\r\n]/.test(value)){process.stdin.off("data",onData);process.stdin.setRawMode?.(false);process.stdin.pause();resolve(JSON.parse(value.trim()));}};
 process.stdin.on("data",onData);process.stdin.resume();
});
try{
 const response=await fetch("https://api.deepseek.com/"+(payload.chat?"chat/completions":"models"),{method:payload.chat?"POST":"GET",headers:{Authorization:"Bearer "+payload.key,"Content-Type":"application/json"},...(payload.chat?{body:JSON.stringify({model:"deepseek-flash",messages:[{role:"user",content:"Reply only: connection verified."}],thinking:{type:"disabled"},max_tokens:16,stream:false})}:{}),redirect:"error",signal:AbortSignal.timeout(20000)});
 const result=await response.json();
 console.log(JSON.stringify({status:response.status,models:result.data?.map(row=>row.id),message:result.choices?.[0]?.message?.content,errorCode:result.error?.code}));
}catch{console.log(JSON.stringify({error:"Provider connection failed"}));process.exitCode=1;}
