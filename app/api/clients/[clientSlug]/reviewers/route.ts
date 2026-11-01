import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canManageWorkspace, requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { generateShareToken } from "@/lib/crypto-tokens";
import { emailSchema } from "@/lib/email-address";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isoDateSchema } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { buildReviewerInviteEmail } from "@/lib/email-templates/reviewer-invite";
import { getRequestLocale } from "@/lib/request-locale";

const createReviewerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  email: emailSchema,
  clientIds: z.array(z.string().min(1).max(64)).min(1, "Selecione ao menos um cliente").max(100),
  role: z.enum(["viewer", "reviewer", "approver"], { message: "Papel inválido" }).default("approver"),
  calendarVersionId: z.string().max(64).optional(),
  expiresAt: isoDateSchema.nullish(),
});

async function getClientForOrg(slug: string, organizationId: string) {
  return prisma.client.findFirst({
    where: { slug, organizationId },
    include: {
      versions: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { organization, membership } = await requireActiveOrganization();
    const canManage = canManageWorkspace(membership.role);
    const { clientSlug } = await params;

    const client = await getClientForOrg(clientSlug, organization.id);
    if (!client) {
      return NextResponse.json(
        { error: localizedText(locale, "Cliente não encontrado", "Client not found.") },
        { status: 404 }
      );
    }

    const links = await prisma.clientReviewerClient.findMany({
      where: { clientId: client.id },
      include: {
        reviewer: {
          include: {
            clientLinks: {
              include: { client: { select: { id: true, name: true, slug: true } } },
            },
            invites: {
              where: { calendarVersion: { clientId: client.id } },
              include: {
                shareToken: { select: { token: true } },
                calendarVersion: { select: { id: true, version: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const reviewers = links.map((link) => ({
      id: link.reviewer.id,
      name: link.reviewer.name,
      email: link.reviewer.email,
      clients: link.reviewer.clientLinks.map((cl) => cl.client),
      invites: link.reviewer.invites.map((invite) => ({
        id: invite.id,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        lastAccessAt: invite.lastAccessAt,
        createdAt: invite.createdAt,
        calendarVersion: invite.calendarVersion.version,
        calendarVersionId: invite.calendarVersion.id,
        // Link pessoal do revisor: só quem gerencia vê, para membros não aprovarem em nome do cliente.
        token: canManage ? invite.shareToken.token : null,
      })),
    }));

    const orgClients = await prisma.client.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ reviewers, orgClients, canManage });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error fetching reviewers:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization({ roles: ["owner", "admin"] });
    const { clientSlug } = await params;
    const { name, email: normalizedEmail, clientIds, role, calendarVersionId, expiresAt } =
      createReviewerSchema.parse(await request.json());

    await enforceRateLimit("inviteOrg", organization.id);

    const client = await getClientForOrg(clientSlug, organization.id);
    if (!client) {
      return NextResponse.json(
        { error: localizedText(locale, "Cliente não encontrado", "Client not found.") },
        { status: 404 }
      );
    }

    const validClients = await prisma.client.findMany({
      where: { organizationId: organization.id, id: { in: clientIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (validClients.length !== clientIds.length) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Um ou mais clientes inválidos",
            "One or more clients are invalid."
          ),
        },
        { status: 400 }
      );
    }

    const targetVersion = calendarVersionId
      ? client.versions.find((v) => v.id === calendarVersionId)
      : client.versions[0];

    if (!targetVersion) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Nenhuma versão de calendário encontrada",
            "No calendar version found."
          ),
        },
        { status: 404 }
      );
    }

    const existingReviewer = await prisma.clientReviewer.findUnique({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: normalizedEmail,
        },
      },
      include: { invites: { where: { status: "active" }, take: 1 } },
    });

    const reviewer = await prisma.clientReviewer.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: normalizedEmail,
        },
      },
      create: {
        organizationId: organization.id,
        name,
        email: normalizedEmail,
      },
      update: {
        name,
      },
    });

    const existingLinks = await prisma.clientReviewerClient.findMany({
      where: { reviewerId: reviewer.id, clientId: { in: clientIds } },
      select: { clientId: true },
    });
    const linkedClientIds = new Set(existingLinks.map((link) => link.clientId));
    const newLinks = clientIds
      .filter((clientId: string) => !linkedClientIds.has(clientId))
      .map((clientId: string) => ({ reviewerId: reviewer.id, clientId }));

    if (newLinks.length > 0) {
      await prisma.clientReviewerClient.createMany({ data: newLinks });
    }

    const shareToken = await prisma.shareToken.create({
      data: {
        calendarVersionId: targetVersion.id,
        token: generateShareToken(),
        kind: "invite",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    const invite = await prisma.clientInvite.create({
      data: {
        reviewerId: reviewer.id,
        calendarVersionId: targetVersion.id,
        shareTokenId: shareToken.id,
        role,
        status: "active",
        invitedByUserId: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        shareToken: { select: { token: true } },
        calendarVersion: { select: { version: true } },
      },
    });

    const shareUrl = `/c/${client.slug}/${targetVersion.version}?t=${invite.shareToken.token}`;

    const emailContent = buildReviewerInviteEmail({
      reviewerName: reviewer.name,
      organizationName: organization.name,
      clientNames: validClients.map((c) => c.name),
      role,
      calendarVersion: targetVersion.version,
      sharePath: shareUrl,
      invitedByName: user.name,
      locale: await getRequestLocale(),
    });

    const emailResult = await sendEmail({
      to: reviewer.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      reviewer,
      invite,
      shareUrl,
      token: invite.shareToken.token,
      emailSent: emailResult.ok,
      emailSkipped: emailResult.skipped ?? false,
    });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating reviewer:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
