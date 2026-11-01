import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { getUserOrganization, requireAuth } from "@/lib/auth";
import { getRequestLocale } from "@/lib/request-locale";

/** Optional answers from the onboarding questions; skipping sends no body. */
const profileSchema = z
  .object({
    role: z.enum(["freelancer", "agency", "in_house"]).optional(),
    clientRange: z.enum(["1-2", "3-5", "6-15", "16+"]).optional(),
    channels: z.array(z.enum(["whatsapp", "email", "slack", "drive", "other"])).max(5).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = profileSchema.safeParse(body ?? {});
    const profile = parsed.success ? parsed.data : {};

    await prisma.user.update({
      where: { id: user.id },
      data: { hasCompletedOnboarding: true },
    });

    // Only the owner describes the business; invited members just finish onboarding.
    const hasAnswers = Boolean(profile.role || profile.clientRange || profile.channels?.length);
    if (hasAnswers) {
      const membership = await getUserOrganization(user.id);
      if (membership?.role === "owner") {
        await prisma.organization.update({
          where: { id: membership.organizationId },
          data: {
            profileRole: profile.role ?? null,
            profileClientRange: profile.clientRange ?? null,
            profileChannels: profile.channels?.length ? [...new Set(profile.channels)].join(",") : null,
            profileAnsweredAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = apiErrorResponse(error, await getRequestLocale());
    if (handled) return handled;
    console.error("Error updating onboarding:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
