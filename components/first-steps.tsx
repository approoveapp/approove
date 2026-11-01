"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { trackEvent } from "@/lib/analytics";

export interface FirstStepsClient {
  slug: string;
  latestToken?: string;
  versions: Array<{ version: string }>;
  stats: { approved: number; adjustments: number; total: number };
}

const ACTIVATED_KEY = "approove-activated";

/**
 * The path to the moment Approove proves itself: a client answering a review link.
 * Hidden once a client has approved or asked for changes on anything.
 */
export function FirstSteps({ clients, aiImport }: { clients: FirstStepsClient[]; aiImport: boolean }) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  const firstClient = clients[0];
  const withPosts = clients.find((client) => client.stats.total > 0);
  const hasClient = clients.length > 0;
  const hasPosts = Boolean(withPosts);
  const clientResponded = clients.some((client) => client.stats.approved + client.stats.adjustments > 0);

  useEffect(() => {
    if (!clientResponded) return;
    try {
      if (window.localStorage.getItem(ACTIVATED_KEY)) return;
      window.localStorage.setItem(ACTIVATED_KEY, "1");
    } catch {
      return;
    }
    trackEvent("first_client_response");
  }, [clientResponded]);

  if (clientResponded) return null;

  const target = withPosts ?? firstClient;
  const clientHref = target ? `/dashboard/clients/${target.slug}` : "/dashboard/clients/new";
  const previewHref =
    target && target.latestToken
      ? `/c/${target.slug}/${target.versions[0]?.version || "v1"}?t=${target.latestToken}`
      : null;

  const steps = [
    {
      done: hasClient,
      title: tr("Adicione seu primeiro cliente", "Add your first client"),
      description: tr("Um cliente por marca que você atende.", "One client for each brand you manage."),
      action: { href: "/dashboard/clients/new", label: tr("Adicionar cliente", "Add client") },
    },
    {
      done: hasPosts,
      title: aiImport
        ? tr("Traga o calendário do mês", "Bring in this month's calendar")
        : tr("Crie as publicações do mês", "Create this month's posts"),
      description: aiImport
        ? tr(
            "Envie a planilha de pauta e as artes em Importar com IA, ou crie as publicações uma a uma.",
            "Upload your content spreadsheet and creatives with Import with AI, or create posts one by one."
          )
        : tr("Adicione arte e legenda a cada publicação.", "Add the creative and caption to each post."),
      action: hasClient ? { href: clientHref, label: tr("Abrir calendário", "Open calendar") } : null,
    },
    {
      done: false,
      title: tr("Envie o link de revisão para o cliente", "Send the review link to your client"),
      description: tr(
        "Mande por WhatsApp, e-mail ou Slack. O cliente revisa no navegador, sem criar conta. Este passo conclui quando ele aprovar ou pedir ajustes.",
        "Share it over email, Slack, or WhatsApp. Your client reviews in the browser, no account needed. This step completes when they approve or request changes."
      ),
      action: hasPosts ? { href: clientHref, label: tr("Pegar o link", "Get the link") } : null,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-lg">{tr("Primeiros passos", "Get started")}</CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {tr(`${doneCount} de ${steps.length}`, `${doneCount} of ${steps.length}`)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Leve um post do seu calendário até a aprovação do cliente.",
            "Take one post from your calendar to your client's approval."
          )}
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const current = index === currentIndex;
            return (
              <li
                key={step.title}
                className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${current ? "border-primary/50 bg-primary/5" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    step.done ? "bg-green-600 text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {step.done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                    {step.title}
                    {step.done && <span className="sr-only"> ({tr("concluído", "done")})</span>}
                  </p>
                  {!step.done && <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>}
                </div>
                {!step.done && step.action && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {index === 2 && previewHref && (
                      <Button asChild variant="outline" size="sm">
                        <a href={previewHref} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {tr("Ver como o cliente", "Preview as client")}
                        </a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant={current ? "default" : "outline"}>
                      <Link href={step.action.href}>
                        {step.action.label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
