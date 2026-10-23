// Import TypeScript/TSX source modules for local regression tests, including aliases.
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
const cache = new Map();
const root = new URL("../", import.meta.url);
export async function moduleFrom(relative, parent = import.meta.url) {
  const source = new URL(relative, parent);
  if (cache.has(source.href)) return cache.get(source.href);
  let code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
    const name = match[1];
    let target;
    if (name.startsWith("@/") || name.startsWith(".")) {
      const local = name.startsWith("@/") ? new URL(name.slice(2), root) : new URL(name, source);
      if (!/\.[cm]?[jt]sx?$/.test(local.pathname)) local.pathname += existsSync(new URL(local.href+".ts")) ? ".ts" : ".tsx";
      target = await compiledUrl(local);
    } else target = import.meta.resolve(name);
    code = code.replace(match[0], "from " + JSON.stringify(target));
  }
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(source.href, url);
  return url;
}
async function compiledUrl(source) { return moduleFrom(source.href); }
export async function importSource(relative, parent = import.meta.url) { return import(await moduleFrom(relative, parent)); }
