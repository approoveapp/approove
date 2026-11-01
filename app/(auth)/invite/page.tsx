"use client";

import { Suspense } from "react";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

function InviteForm() {
  const router = useRouter();
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [email] = useState(emailParam);
  const [step, setStep] = useState<"send" | "verify">("send");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || tr("Erro ao enviar código", "Failed to send code"));
        return;
      }

      setStep("verify");
      setCountdown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError(tr("Erro ao enviar código. Tente novamente.", "Failed to send code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError(tr("Digite o código completo de 6 dígitos", "Enter the full 6-digit code"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signIn("email-code", {
        email,
        code: fullCode,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.code === "rate_limited"
            ? tr("Muitas tentativas. Aguarde alguns minutos.", "Too many attempts. Please wait a few minutes.")
            : tr("Código inválido ou expirado", "Invalid or expired code")
        );
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(tr("Erro ao verificar código. Tente novamente.", "Failed to verify code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fullCode = code.join("");

  useEffect(() => {
    if (fullCode.length === 6 && step === "verify") {
      handleVerifyCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullCode]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight lg:hidden">
          Approove
        </h1>
        <h2 className="text-2xl font-semibold tracking-tight">
          {step === "send"
            ? tr("Acessar sua conta", "Sign in to your account")
            : tr("Digite o código", "Enter the code")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {step === "send"
            ? tr(
                "Enviaremos um código de acesso para o seu e-mail",
                "We'll send an access code to your email"
              )
            : tr(
                `Enviamos um código de 6 dígitos para ${email}`,
                `We sent a 6-digit code to ${email}`
              )}
        </p>
      </div>

      {step === "send" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                value={email}
                readOnly
                className="pl-10 bg-muted/50"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              {error}
            </div>
          )}

          <Button
            onClick={handleSendCode}
            className="w-full h-11"
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tr("Enviando...", "Sending...")}
              </>
            ) : (
              tr("Enviar código de acesso", "Send access code")
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {code.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold"
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              {error}
            </div>
          )}

          <Button
            onClick={handleVerifyCode}
            className="w-full h-11"
            disabled={loading || fullCode.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tr("Verificando...", "Verifying...")}
              </>
            ) : (
              tr("Verificar código", "Verify code")
            )}
          </Button>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep("send");
                setCode(["", "", "", "", "", ""]);
                setError("");
              }}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              {tr("Voltar", "Back")}
            </button>

            <button
              type="button"
              onClick={handleSendCode}
              disabled={countdown > 0 || loading}
              className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {countdown > 0
                ? tr(`Reenviar em ${countdown}s`, `Resend in ${countdown}s`)
                : tr("Reenviar código", "Resend code")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}
