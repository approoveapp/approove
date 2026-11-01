import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";

const updateInviteSchema = z.object({
  status: z.enum(["active", "revoked"]).optional(),
  role: z.enum(["viewer", "reviewer", "approver"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { organization } = await requireActiveOrganization({ roles: ["owner", "admin"] });
    const { inviteId } = await params;
    const { status, role } = updateInviteSchema.parse(await request.json());

    const invite = await prisma.clientInvite.findFirst({
      where: {
        id: inviteId,
        reviewer: { organizationId: organization.id },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: localizedText(locale, "Convite não encontrado", "Invite not found.") },
        { status: 404 }
      );
    }

    const updated = await prisma.clientInvite.update({
      where: { id: inviteId },
      data: {
        ...(status && { status }),
        ...(role && { role }),
      },
    });

    return NextResponse.json({ invite: updated });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error updating invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
