import { NextRequest, NextResponse } from "next/server";
import { getRequestLocale } from "@/lib/request-locale";
import { validateShareToken, touchInviteAccess } from "@/lib/share-access";
import { apiErrorResponse } from "@/lib/api-error";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const token = request.nextUrl.searchParams.get("t");
    const clientSlug = request.nextUrl.searchParams.get("clientSlug") ?? undefined;
    const versionId = request.nextUrl.searchParams.get("versionId") ?? undefined;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    await enforceRateLimit("publicIp", clientIp(request.headers));

    const result = await validateShareToken(token, { clientSlug, versionId });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    await touchInviteAccess(result.access.shareTokenId);

    return NextResponse.json({
      access: {
        clientSlug: result.access.clientSlug,
        calendarVersion: result.access.calendarVersion,
        reviewer: result.access.reviewer,
        permissions: result.access.permissions,
      },
    });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error validating share token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
