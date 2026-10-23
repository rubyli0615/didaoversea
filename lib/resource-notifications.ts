export function isNotifiableResource(type: string) {
  return ["SKILL", "MCP", "AGENT"].includes(type);
}

// Timestamps and editorial bookkeeping are not a user-facing content update.
export function resourceContentChanged(existing: Record<string, unknown>, changes: Record<string, unknown>) {
  return Object.entries(changes).some(([key, value]) => !["updatedAt", "contentRevision"].includes(key) && existing[key] !== value);
}

export function relationSignature(items: Array<{ sourceSkillId: string; targetSkillId: string; triggerCondition: string }>) {
  return JSON.stringify(items.map((item) => [item.sourceSkillId, item.targetSkillId, item.triggerCondition]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
