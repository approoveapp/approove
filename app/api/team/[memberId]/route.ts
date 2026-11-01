import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { invalidDataMessage, localizeValidationMessage } from "@/lib/validation-messages";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/auth";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member"], {
    message: "Função deve ser 'admin' ou 'member'",
  }),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { membership, organization } = await requireOrganization();

    if (membership.role !== "owner") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Apenas o proprietário pode alterar funções",
            "Only the owner can change roles."
          ),
        },
        { status: 403 }
      );
    }

    const { memberId } = await params;
    const body = await request.json();
    const data = updateRoleSchema.parse(body);

    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: memberId,
        organizationId: organization.id,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: localizedText(locale, "Membro não encontrado", "Member not found.") },
        { status: 404 }
      );
    }

    if (targetMembership.userId === membership.userId) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Você não pode alterar sua própria função",
            "You can't change your own role."
          ),
        },
        { status: 400 }
      );
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Não é possível alterar a função do proprietário",
            "The owner's role can't be changed."
          ),
        },
        { status: 400 }
      );
    }

    const updated = await prisma.membership.update({
      where: { id: memberId },
      data: { role: data.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message
            ? localizeValidationMessage(error.issues[0].message, locale)
            : invalidDataMessage(locale),
        },
        { status: 400 }
      );
    }
    console.error("Error updating member role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const locale = await getRequestLocale();
  try {
    const { membership, organization } = await requireOrganization();

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Apenas proprietários e administradores podem remover membros",
            "Only owners and admins can remove members."
          ),
        },
        { status: 403 }
      );
    }

    const { memberId } = await params;

    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: memberId,
        organizationId: organization.id,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: localizedText(locale, "Membro não encontrado", "Member not found.") },
        { status: 404 }
      );
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Não é possível remover o proprietário da organização",
            "The organization owner can't be removed."
          ),
        },
        { status: 400 }
      );
    }

    if (targetMembership.userId === membership.userId) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Você não pode remover a si mesmo",
            "You can't remove yourself."
          ),
        },
        { status: 400 }
      );
    }

    if (targetMembership.role === "admin" && membership.role !== "owner") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Apenas o proprietário pode remover administradores",
            "Only the owner can remove admins."
          ),
        },
        { status: 403 }
      );
    }

    await prisma.membership.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
