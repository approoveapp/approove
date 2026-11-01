import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getRequestLocale } from "@/lib/request-locale";
import { localizedText } from "@/lib/locale";
import { InviteActions } from "./invite-actions";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata(
  "Convites pendentes",
  "Convites pendentes para o Approove."
);

export default async function PendingInvitesPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/login?callbackUrl=/convite");
  }

  const invites = await prisma.membership.findMany({
    where: { userId: user.id, acceptedAt: null },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (invites.length === 0) {
    redirect("/dashboard");
  }

  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-background p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{tr("Convite para equipe", "Team invite")}</h1>
          <p className="text-sm text-muted-foreground">
            {tr(
              "Aceite para trabalhar no espaço da agência. Se recusar, você cria a sua própria agência.",
              "Accept to work in the agency's workspace. If you decline, you create your own agency."
            )}
          </p>
        </div>
        <InviteActions
          invites={invites.map((invite) => ({
            id: invite.id,
            organizationName: invite.organization.name,
            role: invite.role,
          }))}
          labels={{
            accept: tr("Aceitar", "Accept"),
            decline: tr("Recusar", "Decline"),
            admin: tr("Administrador", "Admin"),
            member: tr("Membro", "Member"),
            error: tr("Não foi possível responder ao convite.", "Unable to answer the invite."),
          }}
        />
      </div>
    </main>
  );
}
