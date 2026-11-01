import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization, requireOrganization } from "@/lib/auth";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { emailSchema } from "@/lib/email-address";
import { enforceRateLimit } from "@/lib/rate-limit";
import { planAllows, planLimitResponse } from "@/lib/plan-limits";
import { getEffectivePlan } from "@/lib/billing-access";
import { sendEmail } from "@/lib/email";
import { buildMemberInviteEmail } from "@/lib/email-templates/member-invite";
import { getRequestLocale } from "@/lib/request-locale";

const inviteSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, "Nome é obrigatório").max(120).optional(),
  role: z.enum(["admin", "member"], {
    message: "Função deve ser 'admin' ou 'member'",
  }),
});

export async function GET() {
  try {
    const { organization, membership } = await requireOrganization();

    const members = await prisma.membership.findMany({
      where: { organizationId: organization.id },
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
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      members,
      viewer: { membershipId: membership.id, role: membership.role },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "No organization") {
      return NextResponse.json({ members: [] });
    }
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const { membership, organization } = await requireActiveOrganization({
      roles: ["owner", "admin"],
    });

    const body = await request.json();
    const data = inviteSchema.parse(body);

    // Só o proprietário define administradores (convite ou troca de função).
    if (data.role === "admin" && membership.role !== "owner") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Apenas o proprietário pode convidar administradores",
            "Only the owner can invite admins."
          ),
        },
        { status: 403 }
      );
    }

    await enforceRateLimit("inviteOrg", organization.id);

    const existingMembership = await prisma.membership.findFirst({
      where: {
        organizationId: organization.id,
        user: { email: data.email },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Este usuário já faz parte da organização",
            "This user is already part of the organization."
          ),
        },
        { status: 400 }
      );
    }

    const plan = getEffectivePlan(organization);
    const memberCount = await prisma.membership.count({
      where: { organizationId: organization.id },
    });
    if (!planAllows(plan, "members", memberCount)) {
      return NextResponse.json(planLimitResponse(plan, "members", memberCount, locale), { status: 403 });
    }

    let user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // O Approove trabalha com uma agência por usuário: não puxar quem já tem a sua.
    if (user) {
      const elsewhere = await prisma.membership.count({
        where: { userId: user.id, acceptedAt: { not: null } },
      });
      if (elsewhere > 0) {
        return NextResponse.json(
          {
            error: localizedText(
              locale,
              "Este e-mail já participa de outra agência no Approove",
              "This email is already part of another agency on Approove."
            ),
          },
          { status: 409 }
        );
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: { email: data.email, name: data.name || null },
      });
    } else if (data.name && !user.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: data.name },
      });
    }

    // Convite fica pendente (acceptedAt null) até a pessoa entrar e aceitar.
    const newMembership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: data.role,
        acceptedAt: null,
      },
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

    // Contagem depois de criar: dois convites simultâneos não furam o limite do plano.
    const countAfter = await prisma.membership.count({
      where: { organizationId: organization.id },
    });
    if (!planAllows(plan, "members", countAfter - 1)) {
      await prisma.membership.delete({ where: { id: newMembership.id } });
      return NextResponse.json(planLimitResponse(plan, "members", countAfter - 1, locale), { status: 403 });
    }

    const inviter = await prisma.user.findUnique({
      where: { id: membership.userId },
      select: { name: true },
    });

    const emailContent = buildMemberInviteEmail({
      memberEmail: data.email,
      memberName: data.name || data.email,
      organizationName: organization.name,
      role: data.role,
      invitedByName: inviter?.name,
      locale: await getRequestLocale(),
    });

    const emailResult = await sendEmail({
      to: data.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (emailResult.skipped) {
      console.warn("[team] E-mail de convite não enviado (RESEND_API_KEY não configurada)");
    }

    return NextResponse.json({ member: newMembership });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error inviting member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
