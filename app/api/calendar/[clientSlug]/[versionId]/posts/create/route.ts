import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isoDateSchema } from "@/lib/validation";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveOrganization } from "@/lib/auth";
import { isProductionStage } from "@/lib/production-stages";
import { isOrganizationMember } from "@/lib/post-access";
import { attachmentVersionInclude } from "@/lib/attachment-slides";

const createPostSchema = z.object({
  scheduledAt: isoDateSchema,
  channel: z.string().max(40).optional(),
  title: z.string().max(300).optional(),
  copyText: z.string().max(10000).optional(),
  productionStage: z.string().max(40).optional(),
  assigneeId: z.string().max(64).nullable().optional(),
  handoffNote: z.string().max(2000).optional(),
});

const postInclude = {
  comments: { orderBy: { createdAt: "asc" as const } },
  attachments: {
    orderBy: { order: "asc" as const },
    include: {
      versions: attachmentVersionInclude,
    },
  },
  assignee: { select: { id: true, name: true, email: true } },
  assignedBy: { select: { id: true, name: true, email: true } },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string; versionId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization();
    const { clientSlug, versionId } = await params;
    const body = await request.json();
    const data = createPostSchema.parse(body);

    const calendarVersion = await prisma.calendarVersion.findFirst({
      where: {
        version: versionId,
        client: { slug: clientSlug, organizationId: organization.id },
      },
    });

    if (!calendarVersion) {
      return NextResponse.json(
        { error: localizedText(locale, "Calendário não encontrado", "Calendar not found.") },
        { status: 404 }
      );
    }

    const productionStage =
      data.productionStage && isProductionStage(data.productionStage)
        ? data.productionStage
        : "draft_copy";

    if (data.assigneeId) {
      const isMember = await isOrganizationMember(data.assigneeId, organization.id);
      if (!isMember) {
        return NextResponse.json(
          {
            error: localizedText(
              locale,
              "Responsável deve ser membro da organização",
              "The assignee must be a member of the organization."
            ),
          },
          { status: 400 }
        );
      }
    }

    const post = await prisma.postItem.create({
      data: {
        calendarVersionId: calendarVersion.id,
        scheduledAt: new Date(data.scheduledAt),
        channel: data.channel || "Instagram",
        title: data.title?.trim() || "",
        copyText: data.copyText || "",
        status: "pending",
        productionStage,
        assigneeId: data.assigneeId ?? null,
        assignedAt: data.assigneeId ? new Date() : null,
        assignedById: data.assigneeId ? user.id : null,
        handoffNote: data.handoffNote?.trim() || null,
      },
      include: postInclude,
    });

    return NextResponse.json({ post });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
