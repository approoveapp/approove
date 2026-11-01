import { withImportMediaAccess } from "@/lib/import/private-media-url";
import { NextRequest, NextResponse } from "next/server";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { authorizeCalendarView, rolePermissions, touchInviteAccess } from "@/lib/share-access";
import { attachmentVersionInclude } from "@/lib/attachment-slides";
import { CLIENT_VISIBLE_PRODUCTION_STAGE } from "@/lib/client-content-boundary";
import { serializeAgencyPost, serializeClientPost } from "@/lib/post-serializer";
import { apiErrorResponse } from "@/lib/api-error";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

const publicPostInclude = {
  comments: {
    orderBy: { createdAt: "asc" as const },
  },
  attachments: {
    orderBy: { order: "asc" as const },
    include: {
      versions: attachmentVersionInclude,
    },
  },
  statusEvents: {
    orderBy: { createdAt: "asc" as const },
  },
};

const agencyPostInclude = {
  ...publicPostInclude,
  assignee: { select: { id: true, name: true, email: true } },
  assignedBy: { select: { id: true, name: true, email: true } },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string; versionId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { clientSlug, versionId } = await params;
    const token = request.nextUrl.searchParams.get("t") ?? undefined;

    if (token) {
      await enforceRateLimit("publicIp", clientIp(request.headers));
    }

    const authResult = await authorizeCalendarView(token, clientSlug, versionId);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    if (!authResult.isAgency && authResult.access) {
      await touchInviteAccess(authResult.access.shareTokenId);
    }

    const posts = await prisma.postItem.findMany({
      where: {
        calendarVersionId: authResult.calendarVersionId,
        ...(!authResult.isAgency && {
          productionStage: CLIENT_VISIBLE_PRODUCTION_STAGE,
        }),
      },
      include: authResult.isAgency ? agencyPostInclude : publicPostInclude,
      orderBy: {
        scheduledAt: "asc",
      },
    });

    const serialized = authResult.isAgency
      ? posts.map(serializeAgencyPost)
      : posts.map(serializeClientPost);

    return NextResponse.json({
      posts: withImportMediaAccess(serialized, token),
      isAdmin: authResult.isAgency,
      access: authResult.isAgency
        ? {
            reviewer: null,
            permissions: authResult.canManage
              ? rolePermissions("approver")
              : { ...rolePermissions("reviewer"), canApprove: false },
            legacy: false,
          }
        : {
            reviewer: authResult.access!.reviewer,
            permissions: authResult.access!.permissions,
            legacy: authResult.access!.isLegacy,
          },
    });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
