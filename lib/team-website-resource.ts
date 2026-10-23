import type { ResourceView } from "./resource-types";
import { WEBSITE_TEAMS, type TeamWebsite } from "./team-websites";

// Read-only catalog projection. Editing remains in the authorized team directory.
export function teamWebsiteResource(site: TeamWebsite): ResourceView {
  return {
    id: "team-site:" + site.id, type: "INTERNAL", name: site.name, slug: "team-site-" + site.id,
    resourceModule: "overseas", businessDirection: null, scenario: "other_useful",
    summary: site.description, version: null, tags: [], detail: "", installationCommand: null,
    usageExample: null, documentationUrl: null, implementation: null, caseUrl: null, contact: null,
    installationMode: "none", repositoryAccess: "none", repositoryInstructions: null,
    mcpRequirements: null, dataPermissions: [], sourceUrl: site.url, accessData: null,
    accessMethod: null, toolList: [], knowledgeScope: null, ownerId: "",
    ownerName: WEBSITE_TEAMS.find(team => team.id === site.teamId)?.name ?? "小组网站",
    status: "PUBLISHED", releaseNote: null, createdAt: site.updatedAt, updatedAt: site.updatedAt,
  };
}
