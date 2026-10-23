import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";

export async function runBatches(queries: BatchItem<"sqlite">[]) {
  const db = getDb();
  for (let offset = 0; offset < queries.length; offset += 20) {
    const chunk = queries.slice(offset, offset + 20);
    await db.batch(chunk as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}
