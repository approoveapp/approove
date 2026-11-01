import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageWorkspace, getUserOrganization } from "@/lib/auth";
import { ensureProductAccess } from "@/lib/stripe-sync";
import {
  WORKSPACE_UNAVAILABLE_CODE,
  workspaceUnavailableMessage,
} from "@/lib/workspace-unavailable";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";

export type ClientInviteRole = "viewer" | "reviewer" | "approver";

async function workspaceUnavailable() {
  return {
    ok: false as const,
    error: workspaceUnavailableMessage(await getRequestLocale()),
    status: 403,
    code: WORKSPACE_UNAVAILABLE_CODE,
  };
}

/** Falha de acesso com a mensagem no idioma da requisição (só roda dentro de uma rota). */
async function denied(status: number, portuguese: string, english: string) {
  return {
    ok: false as const,
    error: localizedText(await getRequestLocale(), portuguese, english),
    status,
  };
}

export interface ShareAccessContext {
  shareTokenId: string;
  calendarVersionId: string;
  clientId: string;
  clientSlug: string;
  calendarVersion: string;
  reviewer: {
    id: string;
    name: string;
    email: string;
    role: ClientInviteRole;
  } | null;
  permissions: {
    canComment: boolean;
    canPin: boolean;
    canApprove: boolean;
  };
  /** Link da agência (kind "agency"), sem revisor nomeado: permissões de aprovador. */
  isLegacy: boolean;
}

export function rolePermissions(role: ClientInviteRole) {
  switch (role) {
    case "viewer":
      return { canComment: false, canPin: false, canApprove: false };
    case "reviewer":
      return { canComment: true, canPin: true, canApprove: false };
    case "approver":
    default:
      return { canComment: true, canPin: true, canApprove: true };
  }
}

/** Link da agência mais recente e ativo. Links de revisor nunca entram aqui. */
export async function findAgencyShareToken(
  calendarVersionId: string
): Promise<string | null> {
  const token = await prisma.shareToken.findFirst({
    where: {
      calendarVersionId,
      kind: "agency",
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });

  return token?.token ?? null;
}

export async function authorizeCalendarView(
  token: string | undefined,
  clientSlug: string,
  versionId: string
): Promise<
  | {
      ok: true;
      isAgency: boolean;
      /** Owner/admin da agência. Membros produzem, mas não aprovam em nome do cliente. */
      canManage: boolean;
      access: ShareAccessContext | null;
      calendarVersionId: string;
    }
  | { ok: false; error: string; status: number; code?: string }
> {
  const session = await auth();
  if (session?.user?.id) {
    const membership = await getUserOrganization(session.user.id);

    if (membership) {
      const version = await prisma.calendarVersion.findFirst({
        where: {
          version: versionId,
          client: { slug: clientSlug, organizationId: membership.organizationId },
        },
      });

      if (version) {
        if (!(await ensureProductAccess(membership.organization))) {
          return await workspaceUnavailable();
        }
        return {
          ok: true,
          isAgency: true,
          canManage: canManageWorkspace(membership.role),
          access: null,
          calendarVersionId: version.id,
        };
      }
    }
  }

  if (!token) {
    return await denied(401, "Token necessário", "Token required.");
  }

  const result = await validateShareToken(token, { clientSlug, versionId });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    isAgency: false,
    canManage: false,
    access: result.access,
    calendarVersionId: result.access.calendarVersionId,
  };
}

export async function validateShareToken(
  token: string,
  options?: { clientSlug?: string; versionId?: string }
): Promise<
  | { ok: true; access: ShareAccessContext }
  | { ok: false; error: string; status: number; code?: string }
> {
  const shareToken = await prisma.shareToken.findUnique({
    where: { token },
    include: {
      calendarVersion: {
        include: {
          client: { include: { organization: true } },
        },
      },
      invite: {
        include: {
          reviewer: {
            include: {
              clientLinks: true,
            },
          },
        },
      },
    },
  });

  if (!shareToken || shareToken.revokedAt) {
    return await denied(401, "Token inválido", "Invalid token.");
  }

  // Link de revisor sem convite (revisor removido) nunca vira link anônimo de aprovador.
  if (shareToken.kind !== "agency" && !shareToken.invite) {
    return await denied(401, "Token inválido", "Invalid token.");
  }

  const expiresAt = shareToken.invite?.expiresAt ?? shareToken.expiresAt;
  if (expiresAt && expiresAt < new Date()) {
    return await denied(401, "Token expirado", "This link has expired.");
  }

  if (shareToken.invite?.status === "revoked") {
    return await denied(401, "Convite revogado", "This invite has been revoked.");
  }

  const { calendarVersion } = shareToken;
  const client = calendarVersion.client;

  if (!(await ensureProductAccess(client.organization))) {
    return await workspaceUnavailable();
  }

  if (options?.clientSlug && client.slug !== options.clientSlug) {
    return await denied(403, "Token não corresponde ao cliente", "This link doesn't match this client.");
  }

  if (options?.versionId && calendarVersion.version !== options.versionId) {
    return await denied(403, "Token não corresponde à versão", "This link doesn't match this version.");
  }

  if (shareToken.invite) {
    const { reviewer } = shareToken.invite;
    const linkedToClient = reviewer.clientLinks.some((link) => link.clientId === client.id);
    if (!linkedToClient) {
      return await denied(
        403,
        "Revisor não vinculado a este cliente",
        "Reviewer not assigned to this client"
      );
    }

    const role = shareToken.invite.role as ClientInviteRole;

    return {
      ok: true,
      access: {
        shareTokenId: shareToken.id,
        calendarVersionId: calendarVersion.id,
        clientId: client.id,
        clientSlug: client.slug,
        calendarVersion: calendarVersion.version,
        reviewer: {
          id: reviewer.id,
          name: reviewer.name,
          email: reviewer.email,
          role,
        },
        permissions: rolePermissions(role),
        isLegacy: false,
      },
    };
  }

  // Link da agência - acesso de aprovador, sem revisor nomeado.
  return {
    ok: true,
    access: {
      shareTokenId: shareToken.id,
      calendarVersionId: calendarVersion.id,
      clientId: client.id,
      clientSlug: client.slug,
      calendarVersion: calendarVersion.version,
      reviewer: null,
      permissions: rolePermissions("approver"),
      isLegacy: true,
    },
  };
}

export async function touchInviteAccess(shareTokenId: string) {
  const invite = await prisma.clientInvite.findUnique({
    where: { shareTokenId },
  });
  if (!invite) return;

  await prisma.clientInvite.update({
    where: { id: invite.id },
    data: {
      lastAccessAt: new Date(),
      status: invite.status === "pending" ? "active" : invite.status,
    },
  });
}

export async function isShareTokenAuthorized(
  token: string | undefined,
  calendarVersionId: string
): Promise<boolean> {
  if (!token) return false;

  const result = await validateShareToken(token);
  if (!result.ok) return false;

  return result.access.calendarVersionId === calendarVersionId;
}

export async function authorizeShareOrSession(
  token: string | undefined,
  calendarVersionId: string
): Promise<
  | { ok: true; isAgency: boolean; canManage: boolean; access: ShareAccessContext | null }
  | { ok: false; error: string; status: number; code?: string }
> {
  const session = await auth();
  if (session?.user?.id) {
    const membership = await getUserOrganization(session.user.id);

    if (membership) {
      const ownsCalendar = await prisma.calendarVersion.findFirst({
        where: {
          id: calendarVersionId,
          client: { organizationId: membership.organizationId },
        },
        select: { id: true },
      });

      if (ownsCalendar) {
        if (!(await ensureProductAccess(membership.organization))) {
          return await workspaceUnavailable();
        }
        return {
          ok: true,
          isAgency: true,
          canManage: canManageWorkspace(membership.role),
          access: null,
        };
      }
    }
  }

  if (!token) {
    return await denied(401, "Faça login para continuar", "Unauthorized");
  }

  const result = await validateShareToken(token);
  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status };
  }

  if (result.access.calendarVersionId !== calendarVersionId) {
    return await denied(
      403,
      "Token não corresponde ao calendário",
      "This link doesn't match this calendar."
    );
  }

  await touchInviteAccess(result.access.shareTokenId);

  return { ok: true, isAgency: false, canManage: false, access: result.access };
}
