import { assertImportMediaOrganization } from "@/lib/import/media-write-access";
import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveOrganization } from "@/lib/auth";
import { getAttachmentForOrganization } from "@/lib/post-access";
import {
  attachmentVersionInclude,
  buildSlideCreates,
  normalizeSlides,
  slideInputSchema,
} from "@/lib/attachment-slides";
import { actorFromAuth, invalidateApprovalIfNeeded } from "@/lib/approval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization();
    const { attachmentId } = await params;
    const { url, urls, slides } = slideInputSchema.parse(await request.json());

    const attachment = await getAttachmentForOrganization(attachmentId, organization.id);
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const lastVersion = await prisma.attachmentVersion.findFirst({
      where: { postAttachmentId: attachmentId },
      orderBy: { version: "desc" },
      include: {
        slides: { orderBy: { order: "asc" } },
      },
    });

    const lastVersionNumber = lastVersion?.version ?? 0;

    let slideItems = normalizeSlides(url, urls, slides);
    if (slideItems.length === 0 && lastVersion) {
      slideItems = lastVersion.slides.length
        ? lastVersion.slides.map((slide) => ({
            url: slide.url,
            mediaType: slide.mediaType === "video" ? ("video" as const) : ("image" as const),
          }))
        : [{ url: lastVersion.url, mediaType: "image" as const }];
    }

    assertImportMediaOrganization(slideItems.map(slide => slide.url), organization.id);

    if (slideItems.length === 0) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "URL ou urls são obrigatórios",
            "url or urls is required."
          ),
        },
        { status: 400 }
      );
    }

    const attachmentType = await prisma.postAttachment.findUnique({
      where: { id: attachmentId },
      select: { type: true },
    });

    if (attachmentType?.type === "carousel" && slideItems.length < 2) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Nova versão de carrossel exige ao menos 2 imagens",
            "A new carousel version needs at least 2 images."
          ),
        },
        { status: 400 }
      );
    }

    const version = await prisma.attachmentVersion.create({
      data: {
        postAttachmentId: attachmentId,
        url: slideItems[0].url,
        version: lastVersionNumber + 1,
        slides: {
          create: buildSlideCreates(slideItems),
        },
      },
      include: attachmentVersionInclude.include,
    });

    await invalidateApprovalIfNeeded({
      postId: attachment.postItem.id,
      reason: "creative_version_added",
      actor: actorFromAuth({ isAgency: true, access: null, user }),
    });

    return NextResponse.json({ version });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating attachment version:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
