import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/auth";
import { redirectForAuthError } from "@/lib/auth-redirect";
import { ensureProductAccess } from "@/lib/stripe-sync";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let organization;
  let user;
  let membership;
  try {
    ({ organization, user, membership } = await requireOrganization());
  } catch (error) {
    redirectForAuthError(error);
  }
  const pathname = (await headers()).get("x-approove-pathname") ?? "";
  const billingEscape = pathname.startsWith("/dashboard/settings");

  if (!billingEscape && !(await ensureProductAccess(organization))) {
    redirect("/subscribe");
  }

  // Onboarding asks about the business, so only the owner who signed up sees it.
  if (pathname === "/dashboard" && membership.role === "owner") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { hasCompletedOnboarding: true },
    });
    if (dbUser && !dbUser.hasCompletedOnboarding) {
      redirect("/onboarding");
    }
  }

  return children;
}
