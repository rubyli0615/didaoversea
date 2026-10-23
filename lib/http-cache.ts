// Compression proxies may weaken an ETag; If-None-Match uses weak comparison.
export function matchesEtag(header: string | null, etag: string) {
  return Boolean(header?.split(",").some(value => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag.replace(/^W\//, "")));
}
