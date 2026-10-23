"use client";
import type { DirectoryData } from "./website-layout";
// User-scoped, short-lived memory only. Never persist website data, session tokens or Keys.
const cache = new Map<string,{ data?: DirectoryData; at: number; pending?: Promise<DirectoryData> }>();
export function clearWebsiteDirectories(userId?: string) { if (userId) cache.delete(userId); else cache.clear(); }
export function loadWebsiteDirectories(userId: string, force = false): Promise<DirectoryData> {
  const current = cache.get(userId);
  if (current?.pending) return current.pending;
  if (!force && current?.data && Date.now() - current.at < 60000) return Promise.resolve(current.data);
  const entry = current ?? { at: 0 };
  const pending = (async () => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/website-layout", { signal: controller.signal, cache: "no-store" });
      const result = await response.json() as DirectoryData & {error?:string};
      if (!response.ok) throw Error(result.error || "网站目录加载失败，请重试");
      if (!Array.isArray(result.categories) || !Array.isArray(result.websites) || !Array.isArray(result.layouts)) throw Error("网站目录格式异常");
      if (cache.get(userId) === entry) { entry.data = result; entry.at = Date.now(); }
      return result as DirectoryData;
    } finally { clearTimeout(timeout); }
  })().finally(()=>{entry.pending=undefined;});
  entry.pending = pending; cache.set(userId,entry); return pending;
}
