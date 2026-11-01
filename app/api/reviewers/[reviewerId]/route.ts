import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { emailSchema } from "@/lib/email-address";

const updateReviewerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: emailSchema.optional(),
  clientIds: z.array(z.string().min(1).max(64)).max(100).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewerId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { organization } = await requireActiveOrganization({ roles: ["owner", "admin"] });
    const { reviewerId } = await params;
    const { name, email, clientIds } = updateReviewerSchema.parse(await request.json());

    const reviewer = await prisma.clientReviewer.findFirst({
      where: { id: reviewerId, organizationId: organization.id },
    });

    if (!reviewer) {
      return NextResponse.json(
        { error: localizedText(locale, "Revisor não encontrado", "Reviewer not found.") },
        { status: 404 }
      );
    }

    if (email && email !== reviewer.email) {
      const duplicate = await prisma.clientReviewer.findUnique({
        where: { organizationId_email: { organizationId: organization.id, email } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: localizedText(
              locale,
              "Já existe um revisor com este e-mail",
              "A reviewer with this email already exists."
            ),
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.clientReviewer.update({
      where: { id: reviewerId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
    });

    if (clientIds) {
      const validClients = await prisma.client.findMany({
        where: { organizationId: organization.id, id: { in: clientIds } },
        select: { id: true },
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

      await prisma.clientReviewerClient.deleteMany({
        where: {
          reviewerId,
          client: { organizationId: organization.id },
        },
      });

      await prisma.clientReviewerClient.createMany({
        data: clientIds.map((clientId) => ({ reviewerId, clientId })),
      });
    }

    return NextResponse.json({ reviewer: updated });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error updating reviewer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ reviewerId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { organization } = await requireActiveOrganization({ roles: ["owner", "admin"] });
    const { reviewerId } = await params;

    const reviewer = await prisma.clientReviewer.findFirst({
      where: { id: reviewerId, organizationId: organization.id },
    });

    if (!reviewer) {
      return NextResponse.json(
        { error: localizedText(locale, "Revisor não encontrado", "Reviewer not found.") },
        { status: 404 }
      );
    }

    // Os links do revisor saem junto (ShareToken -> ClientInvite em cascata). Sem isso
    // o token sobraria sem convite e viraria um link anônimo de aprovação.
    await prisma.$transaction([
      prisma.shareToken.deleteMany({ where: { invite: { reviewerId } } }),
      prisma.clientReviewer.delete({ where: { id: reviewerId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error deleting reviewer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
