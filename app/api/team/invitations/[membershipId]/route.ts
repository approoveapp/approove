import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

/** O convidado aceita ou recusa o próprio convite de equipe. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const user = await requireAuth();
    const { membershipId } = await params;
    const { action } = schema.parse(await request.json());

    const invite = await prisma.membership.findFirst({
      where: { id: membershipId, userId: user.id, acceptedAt: null },
    });
    if (!invite) {
      return NextResponse.json(
        { error: localizedText(locale, "Convite não encontrado", "Invite not found.") },
        { status: 404 }
      );
    }

    if (action === "decline") {
      await prisma.membership.delete({ where: { id: invite.id } });
      return NextResponse.json({ success: true });
    }

    const alreadyMember = await prisma.membership.count({
      where: { userId: user.id, acceptedAt: { not: null } },
    });
    if (alreadyMember > 0) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Você já participa de outra agência no Approove",
            "You're already part of another agency on Approove."
          ),
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.membership.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      // Um usuário, uma agência: os outros convites pendentes deixam de valer.
      prisma.membership.deleteMany({
        where: { userId: user.id, acceptedAt: null, id: { not: invite.id } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error answering team invite:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
