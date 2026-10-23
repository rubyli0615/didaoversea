import type { ResourceView } from './resource-types';
import { DATA_MCP_TABLES, TIGER_MCP_DATA, MCP_INVENTORY_TOOLS } from './mcp-inventory-content';

// Legacy owner-provided lists remain readable; edits persist structured, resource-specific content.
export function mcpToolRows(resource?: ResourceView) {
  const known = resource?.slug === 'tiger-mcp' || resource?.slug === 'data-mcp' ? MCP_INVENTORY_TOOLS[resource.slug] : [];
  return (resource?.toolList ?? []).map(name => ({ name, purpose: resource?.toolDescriptions && Object.hasOwn(resource.toolDescriptions, name) ? resource.toolDescriptions[name] : known.find(tool => tool.name === name)?.purpose ?? '' }));
}
export function mcpDataRows(resource?: ResourceView) {
  if (resource && (resource.dataPermissions.length || resource.toolDescriptions !== undefined)) return resource.dataPermissions.map(row => ({ name: row.table, purpose: row.purpose }));
  if (resource?.slug === 'tiger-mcp') return TIGER_MCP_DATA.map(row => ({ ...row }));
  return (resource?.accessData ?? '').split('\n').map(line => line.trim()).filter(line => /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(line)).map(name => ({ name, purpose: DATA_MCP_TABLES.find(table => table.name === name)?.purpose ?? '' }));
}
export function mcpDataNote(resource?: ResourceView) {
  return (resource?.accessData ?? '').split('\n').filter(line => !/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(line.trim())).join('\n').trim();
}
