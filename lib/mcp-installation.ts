// Pure local substitution. Never change the saved template or interpolate unescaped JSON.
export function mcpKeyHeader(slug:string) {
  return slug==="tiger-mcp"?"tiger_user_key":slug==="data-mcp"?"agent_user_key":null;
}
function keyField(header:string) { return new RegExp('("'+header+'"\\s*:\\s*)"(?:\\\\.|[^"\\\\])*"'); }
export function hasMcpKeyField(template:string,header:string|null) { return Boolean(header&&keyField(header).test(template)); }
export function personalizeMcpCommand(template:string,header:string|null,key:string) {
  if(!header||!key)return template;
  return template.replace(keyField(header),(_match,prefix:string)=>prefix+JSON.stringify(key));
}
