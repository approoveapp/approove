import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveOrganization } from "@/lib/auth";
import { isProductionStage } from "@/lib/production-stages";
import { getPostForOrganization, isOrganizationMember } from "@/lib/post-access";
import { attachmentVersionInclude } from "@/lib/attachment-slides";
import { actorFromAuth, recordSubmittedForReview } from "@/lib/approval";
import { databaseUnavailableResponse, isDatabaseUnavailable } from "@/lib/api-error";

const handoffSchema = z.object({
  assigneeId: z.string().nullable().optional(),
  productionStage: z.string(),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization();
    const { postId } = await params;
    const body = await request.json();
    const data = handoffSchema.parse(body);

    if (!isProductionStage(data.productionStage)) {
      return NextResponse.json(
        { error: localizedText(locale, "Etapa de produção inválida", "Invalid production stage.") },
        { status: 400 }
      );
    }

    const post = await getPostForOrganization(postId, organization.id);
    if (!post) {
      return NextResponse.json(
        { error: localizedText(locale, "Publicação não encontrada", "Post not found.") },
        { status: 404 }
      );
    }

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

    const previousStage = post.productionStage;

    const updatedPost = await prisma.postItem.update({
      where: { id: postId },
      data: {
        productionStage: data.productionStage,
        assigneeId: data.assigneeId ?? null,
        assignedAt: new Date(),
        assignedById: user.id,
        ...(data.handoffNote !== undefined && { handoffNote: data.handoffNote || null }),
      },
      include: postInclude,
    });

    await recordSubmittedForReview({
      postItemId: postId,
      previousStage,
      nextStage: data.productionStage,
      actor: actorFromAuth({ isAgency: true, access: null, user }),
    });

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    if (isDatabaseUnavailable(error)) {
      const { json, status } = databaseUnavailableResponse(locale);
      return NextResponse.json(json, { status });
    }
    console.error("Error handing off post:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
