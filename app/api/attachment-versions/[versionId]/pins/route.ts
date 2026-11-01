import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { authorizeShareOrSession } from "@/lib/share-access";
import { isPostVisibleToClient } from "@/lib/client-content-boundary";
import { apiErrorResponse } from "@/lib/api-error";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import type { ShareAccessContext } from "@/lib/share-access";

const PIN_TEXT_MAX = 2000;

/** Revisor só mexe nos próprios pins (link da agência: pins de cliente sem revisor). */
function clientOwnsPin(
  pin: { author: string; reviewerId: string | null },
  access: ShareAccessContext | null
) {
  return pin.author === "client" && pin.reviewerId === (access?.reviewer?.id ?? null);
}

async function getPinPostContext(pinId: string) {
  const pin = await prisma.annotationPin.findUnique({
    where: { id: pinId },
    include: {
      attachmentVersion: {
        include: {
          postAttachment: {
            include: {
              postItem: { select: { calendarVersionId: true, productionStage: true } },
            },
          },
        },
      },
    },
  });
  const postItem = pin?.attachmentVersion.postAttachment.postItem;
  if (!pin || !postItem) return null;
  return {
    calendarVersionId: postItem.calendarVersionId,
    productionStage: postItem.productionStage,
    pin: { author: pin.author, reviewerId: pin.reviewerId },
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { versionId } = await params;
    await enforceRateLimit("publicIp", clientIp(request.headers));
    const body = await request.json();
    const { xPercent, yPercent, text, token, slideId } = body;

    const x = Number(xPercent);
    const y = Number(yPercent);

    if (!Number.isFinite(x) || !Number.isFinite(y) || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "xPercent, yPercent e text são obrigatórios",
            "xPercent, yPercent and text are required."
          ),
        },
        { status: 400 }
      );
    }

    if (text.length > PIN_TEXT_MAX) {
      return NextResponse.json(
        { error: localizedText(locale, "Anotação muito longa", "Annotation is too long.") },
        { status: 400 }
      );
    }

    if (slideId !== undefined && slideId !== null && typeof slideId !== "string") {
      return NextResponse.json(
        { error: localizedText(locale, "slideId inválido", "Invalid slideId.") },
        { status: 400 }
      );
    }

    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Coordenadas devem estar entre 0 e 100",
            "Coordinates must be between 0 and 100."
          ),
        },
        { status: 400 }
      );
    }

    const version = await prisma.attachmentVersion.findUnique({
      where: { id: versionId },
      include: {
        postAttachment: {
          include: { postItem: { select: { calendarVersionId: true, productionStage: true } } },
        },
      },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const postItem = version.postAttachment.postItem;
    const authResult = await authorizeShareOrSession(token, postItem.calendarVersionId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error, code: "code" in authResult ? authResult.code : undefined }, { status: authResult.status });
    }

    if (!authResult.isAgency && !isPostVisibleToClient(postItem.productionStage)) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (!authResult.isAgency && !authResult.access?.permissions.canPin) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Sem permissão para anotar",
            "You don't have permission to annotate."
          ),
        },
        { status: 403 }
      );
    }

    // O slide precisa ser desta versão; senão o pin apareceria no material de outra agência.
    if (slideId) {
      const slide = await prisma.attachmentSlide.findFirst({
        where: { id: slideId, attachmentVersionId: versionId },
        select: { id: true },
      });
      if (!slide) {
        return NextResponse.json(
          { error: localizedText(locale, "Slide não encontrado", "Slide not found.") },
          { status: 404 }
        );
      }
    }

    if (!authResult.isAgency && token) {
      await enforceRateLimit("publicWriteToken", token);
    }

    const resolvedAuthor = authResult.isAgency ? "agency" : "client";

    const pin = await prisma.annotationPin.create({
      data: {
        attachmentVersionId: versionId,
        attachmentSlideId: slideId || null,
        xPercent: x,
        yPercent: y,
        text: text.trim(),
        author: resolvedAuthor,
        authorName: authResult.isAgency ? null : authResult.access?.reviewer?.name ?? null,
        reviewerId: authResult.isAgency ? null : authResult.access?.reviewer?.id ?? null,
      },
    });

    return NextResponse.json({ pin });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating annotation pin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    await enforceRateLimit("publicIp", clientIp(request.headers));
    const body = await request.json();
    const { pinId, resolved, token } = body;

    if (!pinId || typeof resolved !== "boolean") {
      return NextResponse.json(
        { error: "pinId and resolved are required" },
        { status: 400 }
      );
    }

    const pinContext = await getPinPostContext(pinId);
    if (!pinContext) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    const authResult = await authorizeShareOrSession(token, pinContext.calendarVersionId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error, code: "code" in authResult ? authResult.code : undefined }, { status: authResult.status });
    }

    if (!authResult.isAgency && !isPostVisibleToClient(pinContext.productionStage)) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    if (!authResult.isAgency && !authResult.access?.permissions.canPin) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Sem permissão para alterar anotações",
            "You don't have permission to change annotations."
          ),
        },
        { status: 403 }
      );
    }

    if (!authResult.isAgency && !clientOwnsPin(pinContext.pin, authResult.access)) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Você só pode alterar suas anotações",
            "You can only change your own annotations."
          ),
        },
        { status: 403 }
      );
    }

    const pin = await prisma.annotationPin.update({
      where: { id: pinId },
      data: { resolved },
    });

    return NextResponse.json({ pin });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error updating pin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    await enforceRateLimit("publicIp", clientIp(request.headers));
    const body = await request.json();
    const { pinId, token } = body;

    if (!pinId) {
      return NextResponse.json({ error: "pinId is required" }, { status: 400 });
    }

    const pinContext = await getPinPostContext(pinId);
    if (!pinContext) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    const authResult = await authorizeShareOrSession(token, pinContext.calendarVersionId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error, code: "code" in authResult ? authResult.code : undefined }, { status: authResult.status });
    }

    if (!authResult.isAgency && !isPostVisibleToClient(pinContext.productionStage)) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    if (!authResult.isAgency && !authResult.access?.permissions.canPin) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Sem permissão para excluir anotações",
            "You don't have permission to delete annotations."
          ),
        },
        { status: 403 }
      );
    }

    if (!authResult.isAgency && !clientOwnsPin(pinContext.pin, authResult.access)) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Você só pode excluir suas anotações",
            "You can only delete your own annotations."
          ),
        },
        { status: 403 }
      );
    }

    await prisma.annotationPin.delete({ where: { id: pinId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error deleting pin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
