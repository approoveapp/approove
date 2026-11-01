import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isoDateSchema } from "@/lib/validation";
import { apiErrorResponse } from "@/lib/api-error";
import { canManageWorkspace, requireActiveOrganization } from "@/lib/auth";
import { isProductionStage } from "@/lib/production-stages";
import { getPostForOrganization, isOrganizationMember } from "@/lib/post-access";
import { attachmentVersionInclude } from "@/lib/attachment-slides";
import { actorFromAuth, invalidateApprovalIfNeeded, recordSubmittedForReview } from "@/lib/approval";

const updatePostSchema = z.object({
  scheduledAt: isoDateSchema.optional(),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization();
    const { postId } = await params;
    const body = await request.json();
    const data = updatePostSchema.parse(body);

    const post = await getPostForOrganization(postId, organization.id);
    if (!post) {
      return NextResponse.json(
        { error: localizedText(locale, "Publicação não encontrada", "Post not found.") },
        { status: 404 }
      );
    }

    if (data.productionStage && !isProductionStage(data.productionStage)) {
      return NextResponse.json(
        { error: localizedText(locale, "Etapa de produção inválida", "Invalid production stage.") },
        { status: 400 }
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

    const assigneeChanged =
      data.assigneeId !== undefined && data.assigneeId !== post.assigneeId;
    const stageChanged =
      data.productionStage !== undefined && data.productionStage !== post.productionStage;
    const shouldStampHandoff = assigneeChanged || stageChanged;

    const copyChanged =
      data.copyText !== undefined && data.copyText !== post.copyText;
    const titleChanged =
      data.title !== undefined && data.title.trim() !== post.title;

    const actor = actorFromAuth({
      isAgency: true,
      access: null,
      user,
    });

    if (copyChanged) {
      await invalidateApprovalIfNeeded({
        postId,
        reason: "copy_changed",
        actor,
      });
    } else if (titleChanged) {
      await invalidateApprovalIfNeeded({
        postId,
        reason: "title_changed",
        actor,
      });
    }

    const previousStage = post.productionStage;

    const updatedPost = await prisma.postItem.update({
      where: { id: postId },
      data: {
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.channel && { channel: data.channel }),
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.copyText !== undefined && { copyText: data.copyText }),
        ...(data.productionStage && { productionStage: data.productionStage }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.handoffNote !== undefined && { handoffNote: data.handoffNote.trim() || null }),
        ...(shouldStampHandoff && {
          assignedAt: new Date(),
          assignedById: user.id,
        }),
      },
      include: postInclude,
    });

    if (data.productionStage) {
      await recordSubmittedForReview({
        postItemId: postId,
        previousStage,
        nextStage: data.productionStage,
        actor,
      });
    }

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error updating post:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { organization, membership } = await requireActiveOrganization();
    const { postId } = await params;

    const post = await getPostForOrganization(postId, organization.id);
    if (!post) {
      return NextResponse.json(
        { error: localizedText(locale, "Publicação não encontrada", "Post not found.") },
        { status: 404 }
      );
    }

    // Apagar o post apaga o histórico de aprovação junto (cascade). Membro só apaga
    // o que ainda não foi enviado ao cliente; depois disso, só owner/admin.
    if (!canManageWorkspace(membership.role)) {
      const history = await prisma.postStatusEvent.count({ where: { postItemId: postId } });
      if (history > 0) {
        return NextResponse.json(
          {
            error: localizedText(
              locale,
              "Esta publicação já tem histórico de aprovação. Peça a um administrador para apagá-la.",
              "This post already has approval history. Ask an admin to delete it."
            ),
            code: "FORBIDDEN_ROLE",
          },
          { status: 403 }
        );
      }
    }

    await prisma.postItem.delete({
      where: { id: postId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error deleting post:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
