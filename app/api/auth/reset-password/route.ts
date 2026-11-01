import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getValidPasswordResetToken, resetPasswordWithToken } from "@/lib/password-reset";
import { apiErrorResponse } from "@/lib/api-error";
import { passwordSchema } from "@/lib/email-address";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token obrigatório").max(256),
  password: passwordSchema,
});

export async function GET(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    await enforceRateLimit("resetIp", clientIp(request.headers));

    const record = await getValidPasswordResetToken(token);
    return NextResponse.json({ valid: !!record });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error validating reset token:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const { token, password } = resetPasswordSchema.parse(await request.json());

    await enforceRateLimit("resetIp", clientIp(request.headers));

    const hashedPassword = await bcrypt.hash(password, 12);
    const ok = await resetPasswordWithToken(token, hashedPassword);

    if (!ok) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Link inválido ou expirado. Solicite uma nova redefinição.",
            "Invalid or expired link. Request a new password reset."
          ),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: localizedText(locale, "Senha redefinida com sucesso", "Password reset successfully."),
    });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
