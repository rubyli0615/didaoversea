import {and,eq,ne,or} from "drizzle-orm";
import {resources} from "@/db/schema";
import type {SafeUser} from "./resource-types";

// Keep catalog, detail and relation pickers on the same visibility boundary.
export function visibleResourceFilter(actor:Pick<SafeUser,"id"|"role">){
 return and(ne(resources.status,"ARCHIVED"),actor.role==="ADMIN"?undefined:or(eq(resources.status,"PUBLISHED"),eq(resources.ownerId,actor.id)));
}
