import { auth } from "@/auth";
import { prisma } from "./prisma";
import { ensureOrganizationForUser } from "@/lib/ensure-organization";
import { ApiError } from "@/lib/api-error";
import { ensureProductAccess } from "@/lib/stripe-sync";
import {
  WORKSPACE_UNAVAILABLE_CODE,
  WORKSPACE_UNAVAILABLE_MESSAGE,
  WORKSPACE_UNAVAILABLE_MESSAGE_EN,
} from "@/lib/workspace-unavailable";

export type OrganizationRole = "owner" | "admin" | "member";

export async function getSession() {
  const session = await auth();
  return session;
}

/** Sessão válida. O callback `jwt` já invalida tokens de usuário removido ou com sessão revogada. */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return { ...session.user, id: session.user.id };
}

/** Membership aceita mais antiga. Convites pendentes não dão acesso. */
export async function getUserOrganization(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, acceptedAt: { not: null } },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  return membership;
}

export async function hasPendingInvites(userId: string) {
  const pending = await prisma.membership.count({
    where: { userId, acceptedAt: null },
  });
  return pending > 0;
}

export async function requireOrganization() {
  const user = await requireAuth();

  let membership = await getUserOrganization(user.id);

  if (!membership) {
    if (await hasPendingInvites(user.id)) {
      throw new ApiError(
        403,
        { pt: "Você tem um convite pendente", en: "You have a pending invite." },
        "INVITE_PENDING"
      );
    }
    membership = await ensureOrganizationForUser({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  }

  if (!membership) {
    throw new Error("No organization");
  }

  return { user, membership, organization: membership.organization };
}

export function canManageWorkspace(role: string) {
  return role === "owner" || role === "admin";
}

export function requireRole(
  membership: { role: string },
  allowed: OrganizationRole[] = ["owner", "admin"]
) {
  if (!allowed.includes(membership.role as OrganizationRole)) {
    throw new ApiError(
      403,
      {
        pt: "Apenas proprietários e administradores podem fazer isso",
        en: "Only owners and admins can do this.",
      },
      "FORBIDDEN_ROLE"
    );
  }
}

/**
 * Organização com acesso ao produto (trial ou assinatura). Toda rota da agência
 * que lê ou altera dados de trabalho passa por aqui: o paywall vale na API, não só na UI.
 */
export async function requireActiveOrganization(options?: { roles?: OrganizationRole[] }) {
  const context = await requireOrganization();

  if (options?.roles) {
    requireRole(context.membership, options.roles);
  }

  const organization = await ensureProductAccess(context.organization);
  if (!organization) {
    throw new ApiError(
      402,
      { pt: WORKSPACE_UNAVAILABLE_MESSAGE, en: WORKSPACE_UNAVAILABLE_MESSAGE_EN },
      WORKSPACE_UNAVAILABLE_CODE
    );
  }

  return { ...context, organization };
}
