import { LoginScreen } from "@/components/login-screen";
import { WorkspaceApp } from "@/components/workspace-app";
import { getCurrentUser } from "@/lib/auth";
import { ensureBootstrapData } from "@/lib/bootstrap";
import { readResourceCatalog } from "@/lib/resource-catalog";

export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <LoginScreen/>;
  await ensureBootstrapData();
  const catalog = await readResourceCatalog(user, true);
  return <WorkspaceApp initialUser={user} initialCatalog={catalog} />;
}
