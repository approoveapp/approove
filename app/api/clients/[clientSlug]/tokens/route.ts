import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { generateShareToken } from "@/lib/crypto-tokens";

/**
 * Gera o link da agência da versão atual. Links anteriores da agência são revogados
 * (rotação): quem tinha o link antigo perde o acesso. Links de revisores não mudam.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { organization } = await requireActiveOrganization({ roles: ["owner", "admin"] });
    const { clientSlug } = await params;

    const client = await prisma.client.findFirst({
      where: { slug: clientSlug, organizationId: organization.id },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: localizedText(locale, "Cliente não encontrado", "Client not found.") },
        { status: 404 }
      );
    }

    const latestVersion = client.versions[0];
    if (!latestVersion) {
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

    const [, token] = await prisma.$transaction([
      prisma.shareToken.updateMany({
        where: { calendarVersionId: latestVersion.id, kind: "agency", revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.shareToken.create({
        data: { calendarVersionId: latestVersion.id, token: generateShareToken(), kind: "agency" },
      }),
    ]);

    const shareUrl = `/c/${client.slug}/${latestVersion.version}?t=${token.token}`;

    return NextResponse.json({ token: token.token, shareUrl });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
