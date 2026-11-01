import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { authorizeShareOrSession } from "@/lib/share-access";
import { isPostVisibleToClient } from "@/lib/client-content-boundary";
import { apiErrorResponse } from "@/lib/api-error";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { commentTextSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { postId } = await params;
    await enforceRateLimit("publicIp", clientIp(request.headers));
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token : undefined;
    const text = commentTextSchema.parse(body?.text);

    const post = await prisma.postItem.findUnique({
      where: { id: postId },
      include: {
        calendarVersion: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const authResult = await authorizeShareOrSession(token, post.calendarVersionId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error, code: "code" in authResult ? authResult.code : undefined }, { status: authResult.status });
    }

    if (!authResult.isAgency && !isPostVisibleToClient(post.productionStage)) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!authResult.isAgency && !authResult.access?.permissions.canComment) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Sem permissão para comentar",
            "You don't have permission to comment."
          ),
        },
        { status: 403 }
      );
    }

    if (!authResult.isAgency && token) {
      await enforceRateLimit("publicWriteToken", token);
    }

    const session = await auth();
    const author = authResult.isAgency ? "agency" : "client";
    const authorName = authResult.isAgency
      ? session?.user?.name?.trim() || session?.user?.email?.trim() || null
      : authResult.access?.reviewer?.name ?? null;

    const comment = await prisma.comment.create({
      data: {
        postItemId: postId,
        text,
        author,
        authorName,
        reviewerId: authResult.isAgency ? null : authResult.access?.reviewer?.id ?? null,
      },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
