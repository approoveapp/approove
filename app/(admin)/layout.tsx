import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrialBanner } from "@/components/trial-banner";
import { canManageWorkspace, requireOrganization } from "@/lib/auth";
import { redirectForAuthError } from "@/lib/auth-redirect";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata("Approove", "Painel Approove.", {
  absoluteTitle: true,
});

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let membership;
  try {
    ({ membership } = await requireOrganization());
  } catch (error) {
    redirectForAuthError(error);
  }
  const canManage = canManageWorkspace(membership.role);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <AppSidebar canManage={canManage} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <MobileSidebar canManage={canManage} />
          <div className="flex-1" />
          <TrialBanner />
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
