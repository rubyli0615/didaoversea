export type Role = "ADMIN" | "CREATOR" | "VIEWER";
export type ResourceType = "SKILL" | "MCP" | "AGENT" | "INTERNAL" | "OTHER";
export type ResourceStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type DataPermission = { priority: string; table: string; purpose: string };
export type CommonQa = { question: string; answer: string };

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  hasKey?: boolean;
};

export type ResourceUpdateNotice = { revision: number; kind: "new" | "updated"; at: number };

export type ResourceView = {
  isSummary?: boolean;
  contentRevision?: number;
  resourceModule?: "dida" | "overseas" | "other" | null;
  updateNotice?: ResourceUpdateNotice | null;
  id: string;
  type: ResourceType;
  name: string;
  slug: string;
  businessDirection: string | null;
  scenario: string | null;
  summary: string;
  version: string | null;
  tags: string[];
  detail: string;
  installationCommand: string | null;
  usageExample: string | null;
  usageInstructions?: string | null;
  documentationUrl: string | null;
  referenceUrl?: string | null;
  commonQa?: CommonQa[];
  websiteCategoryId?: string | null;
  implementation: string | null;
  caseUrl: string | null;
  contact: string | null;
  installationMode: string;
  repositoryAccess: string;
  repositoryInstructions: string | null;
  mcpRequirements: string | null;
  tablePermissionReason?: string | null;
  dataPermissions: DataPermission[];
  sourceUrl: string | null;
  accessData: string | null;
  accessMethod: string | null;
  toolList: string[];
  toolDescriptions?: Record<string, string>;
  knowledgeScope: string | null;
  ownerId: string;
  ownerName: string;
  status: ResourceStatus;
  releaseNote: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SkillRelationView = {
  id: string;
  sourceSkillId: string;
  targetSkillId: string;
  triggerCondition: string;
};

export const BUSINESS_DIRECTIONS = [
  { id: "resource_optimization", label: "资源优化", number: "01", note: "供应商资源、价格、BRG 与资源竞争力" },
  { id: "enhanced_matching", label: "增强匹配", number: "02", note: "酒店、房型、静态信息与映射准确性" },
  { id: "technical_operations", label: "技术运营", number: "03", note: "指标监控、异常诊断、订单与 API 运营" },
  { id: "exposure_expansion", label: "曝光拓展", number: "04", note: "渠道覆盖、资源展示和售卖曝光" },
] as const;

export const SKILL_CATEGORIES = [...BUSINESS_DIRECTIONS, { id: "other", label: "其他" }] as const;

export function contactLabel(contact: string | null | undefined, fallback = "") {
  const value = contact?.trim() || fallback;
  // Older resources stored “name · email”. Prefer one human-readable identity.
  return value.includes("·") ? value.split("·")[0].trim() : value;
}
export type CatalogData = {resources:ResourceView[];relations:SkillRelationView[];notModified?:boolean};
