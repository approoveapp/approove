import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { slugFromName } from "@/lib/org-slug";
import { claimTrialFields } from "@/lib/ensure-organization";
import { emailSchema, passwordSchema } from "@/lib/email-address";
import { apiErrorResponse } from "@/lib/api-error";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(120),
  email: emailSchema,
  password: passwordSchema,
  organizationName: z
    .string()
    .trim()
    .min(2, "Nome da empresa deve ter pelo menos 2 caracteres")
    .max(80, "Nome da empresa muito longo"),
});

export async function POST(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const body = await request.json();
    const data = signupSchema.parse(body);

    await enforceRateLimit("signupIp", clientIp(request.headers));

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Este email já está cadastrado. Entre ou use \"Esqueci minha senha\".",
            "This email is already registered. Sign in or use \"Forgot your password?\"."
          ),
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const slug = slugFromName(data.organizationName);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
        },
      });

      let finalSlug = slug;
      const existingOrg = await tx.organization.findUnique({
        where: { slug },
      });
      if (existingOrg) {
        finalSlug = `${slug}-${Date.now().toString(36)}`;
      }

      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug: finalSlug,
          ...(await claimTrialFields(tx, user.id)),
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "owner",
          acceptedAt: new Date(),
        },
      });

      return { user, organization };
    });

    return NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
