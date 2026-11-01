import { NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveOrganization } from "@/lib/auth";

export async function GET() {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization();

    const tasks = await prisma.postItem.findMany({
      where: {
        assigneeId: user.id,
        productionStage: { not: "ready_for_client" },
        calendarVersion: { client: { organizationId: organization.id } },
      },
      include: {
        calendarVersion: {
          include: {
            client: { select: { slug: true, name: true } },
          },
        },
      },
      orderBy: [{ assignedAt: "desc" }, { scheduledAt: "asc" }],
      take: 20,
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
