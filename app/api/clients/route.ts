import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, requireActiveOrganization } from "@/lib/auth";
import { findAgencyShareToken } from "@/lib/share-access";
import { apiErrorResponse } from "@/lib/api-error";
import { generateShareToken, randomSlugSuffix } from "@/lib/crypto-tokens";
import { clientFieldsSchema, slugSchema } from "@/lib/validation";
import { planAllows, planLimitResponse } from "@/lib/plan-limits";
import { getEffectivePlan } from "@/lib/billing-access";

const createClientSchema = clientFieldsSchema.extend({ slug: slugSchema });

export async function GET() {
  const locale = await getRequestLocale();
  try {
    const { organization, membership } = await requireActiveOrganization();
    const canManage = canManageWorkspace(membership.role);

    const clients = await prisma.client.findMany({
      where: { organizationId: organization.id },
      include: {
        versions: {
          include: {
            posts: {
              select: { status: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const latestVersion = client.versions[0];
        const posts = latestVersion?.posts || [];
        // Link da agência aprova como cliente: só quem gerencia recebe.
        const shareToken = canManage && latestVersion
          ? await findAgencyShareToken(latestVersion.id)
          : null;

        return {
          ...client,
          stats: {
            pending: posts.filter((p) => p.status === "pending").length,
            approved: posts.filter((p) => p.status === "approved").length,
            adjustments: posts.filter((p) => p.status === "adjustments").length,
            total: posts.length,
          },
          latestToken: shareToken ?? undefined,
        };
      })
    );

    return NextResponse.json({ clients: clientsWithStats, canManage });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const { organization } = await requireActiveOrganization({ roles: ["owner", "admin"] });
    const data = createClientSchema.parse(await request.json());

    const ownSlug = await prisma.client.findFirst({
      where: { slug: data.slug, organizationId: organization.id },
      select: { id: true },
    });
    if (ownSlug) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Você já tem um cliente com este slug",
            "You already have a client with this slug."
          ),
        },
        { status: 400 }
      );
    }

    // Slugs são globais (URL pública). Se outra agência já usa, um sufixo aleatório
    // evita conflito sem revelar que o slug existe.
    const takenElsewhere = await prisma.client.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    const slug = takenElsewhere ? `${data.slug}-${randomSlugSuffix()}` : data.slug;

    const plan = getEffectivePlan(organization);
    const clientCount = await prisma.client.count({
      where: { organizationId: organization.id },
    });
    if (!planAllows(plan, "clients", clientCount)) {
      return NextResponse.json(planLimitResponse(plan, "clients", clientCount, locale), { status: 403 });
    }

    const client = await prisma.client.create({
      data: {
        organizationId: organization.id,
        name: data.name,
        slug,
        cnpj: data.cnpj,
        address: data.address,
        website: data.website,
        instagram: data.instagram,
        facebook: data.facebook,
        linkedin: data.linkedin,
        versions: {
          create: {
            version: "v1",
            tokens: { create: { token: generateShareToken(), kind: "agency" } },
          },
        },
      },
    });

    // Contagem depois de criar: requisições simultâneas não furam o limite do plano.
    const countAfter = await prisma.client.count({
      where: { organizationId: organization.id },
    });
    if (!planAllows(plan, "clients", countAfter - 1)) {
      await prisma.client.delete({ where: { id: client.id } });
      return NextResponse.json(planLimitResponse(plan, "clients", countAfter - 1, locale), { status: 403 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
