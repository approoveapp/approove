"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { googleAuthErrorMessage } from "@/lib/google-auth";

export default function SignupPage() {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || tr("Erro ao criar conta", "Unable to create account"));
        return;
      }

      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(tr("Erro ao criar conta. Tente novamente.", "Unable to create account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const result = await signIn("google", {
        callbackUrl: "/dashboard",
        redirect: false,
      });
      if (result?.error) {
        setError(googleAuthErrorMessage(result.error, tr));
        setGoogleLoading(false);
        return;
      }
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      setGoogleLoading(false);
    } catch {
      setError(tr("Não foi possível entrar com o Google.", "Unable to continue with Google."));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight lg:hidden">
          Approove
        </h1>
        <h2 className="text-2xl font-semibold tracking-tight">
          {tr("Crie sua conta", "Create your account")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tr("Teste grátis por 15 dias, sem cartão. Leva um minuto.", "Free for 15 days, no credit card. Takes a minute.")}
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          {error}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-11"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {tr("Continuar com Google", "Continue with Google")}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {tr("ou crie com email", "or create an account with email")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{tr("Seu nome", "Your name")}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder={tr("João Silva", "Jane Doe")}
            value={formData.name}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={tr("seu@email.com", "you@example.com")}
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{tr("Senha", "Password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={tr("Mínimo 8 caracteres", "At least 8 characters")}
            value={formData.password}
            onChange={handleChange}
            required
            minLength={8}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">{tr("Nome do seu negócio", "Your business name")}</Label>
          <Input
            id="organizationName"
            name="organizationName"
            type="text"
            placeholder={tr("Ex.: Ana Lima Social ou Agência Pixel", "e.g. Jane Doe Social or Pixel Studio")}
            value={formData.organizationName}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tr("Criando conta...", "Creating account...")}
            </>
          ) : (
            tr("Criar conta grátis", "Create a free account")
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {tr("Já tem uma conta?", "Already have an account?")}{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {tr("Fazer login", "Log in")}
        </Link>
      </p>
    </div>
  );
}
