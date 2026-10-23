import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["ADMIN", "CREATOR", "VIEWER"] }).notNull(),
    keySalt: text("key_salt"),
    keyHash: text("key_hash"),
    keyUpdatedAt: integer("key_updated_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)],
);

export const resources = sqliteTable(
  "resources",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["SKILL", "MCP", "AGENT", "INTERNAL", "OTHER"] }).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    businessDirection: text("business_direction"),
    scenario: text("scenario"),
    resourceModule: text("resource_module", { enum: ["dida", "overseas", "other"] }),
    summary: text("summary").notNull(),
    version: text("version"),
    tags: text("tags").notNull().default("[]"),
    detail: text("detail").notNull().default(""),
    installationCommand: text("installation_command"),
    usageExample: text("usage_example"),
    usageInstructions: text("usage_instructions"),
    documentationUrl: text("documentation_url"),
    referenceUrl: text("reference_url"),
    commonQa: text("common_qa").notNull().default("[]"),
    websiteCategoryId: text("website_category_id").references(() => websiteCategories.id),
    implementation: text("implementation"),
    caseUrl: text("case_url"),
    contact: text("contact"),
    installationMode: text("installation_mode").notNull().default("pending"),
    repositoryAccess: text("repository_access").notNull().default("none"),
    repositoryInstructions: text("repository_instructions"),
    mcpRequirements: text("mcp_requirements"),
    tablePermissionReason: text("table_permission_reason"),
    dataPermissions: text("data_permissions").notNull().default("[]"),
    contentRevision: integer("content_revision").notNull().default(0),
    notificationRevision: integer("notification_revision").notNull().default(0),
    notificationKind: text("notification_kind", { enum: ["new", "updated"] }).notNull().default("updated"),
    notificationAt: integer("notification_at"),
    sourceUrl: text("source_url"),
    accessData: text("access_data"),
    accessMethod: text("access_method"),
    toolList: text("tool_list").notNull().default("[]"),
    toolDescriptions: text("tool_descriptions"),
    knowledgeScope: text("knowledge_scope"),
    ownerId: text("owner_id").notNull().references(() => users.id),
    status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }).notNull().default("DRAFT"),
    releaseNote: text("release_note"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("resources_slug_unique").on(table.slug)],
);

export const skillRelations = sqliteTable("skill_relations", {
  id: text("id").primaryKey(),
  sourceSkillId: text("source_skill_id").notNull().references(() => resources.id),
  targetSkillId: text("target_skill_id").notNull().references(() => resources.id),
  triggerCondition: text("trigger_condition").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  detail: text("detail"),
  createdAt: integer("created_at").notNull(),
});

export const teamWebsites = sqliteTable("team_websites", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  url: text("url").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  updatedBy: text("updated_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("team_websites_team_url_unique").on(table.teamId, table.url)]);
export const resourceReads = sqliteTable("resource_reads", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  resourceId: text("resource_id").notNull().references(() => resources.id),
  revision: integer("revision").notNull().default(0),
  readAt: integer("read_at").notNull(),
}, (table) => [uniqueIndex("resource_reads_user_resource_unique").on(table.userId, table.resourceId)]);

export const websiteCategories = sqliteTable("website_categories", {
  id: text("id").primaryKey(),
  scenario: text("scenario").notNull(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [uniqueIndex("website_categories_scenario_name_unique").on(table.scenario, table.nameKey)]);

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  version: integer("version").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Shared directory presentation only; resource membership remains on the resource itself.
export const websiteLayouts = sqliteTable("website_layouts", {
  scenario: text("scenario").primaryKey(),
  operationId: text("operation_id").notNull().default(""),
  siteIds: text("site_ids").notNull().default("[]"),
  groupIds: text("group_ids").notNull().default("[]"),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});
export const analysisRuns=sqliteTable("analysis_runs",{
 id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>users.id),
 status:text("status",{enum:["RUNNING","SUCCEEDED","FAILED","CANCELLED"]}).notNull(),
 createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),
},table=>[uniqueIndex("analysis_one_running_per_user").on(table.userId).where(sql`status = 'RUNNING'`)]);

