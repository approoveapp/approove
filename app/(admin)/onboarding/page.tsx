"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { trackEvent } from "@/lib/analytics";

type Role = "freelancer" | "agency" | "in_house";
type ClientRange = "1-2" | "3-5" | "6-15" | "16+";
type Channel = "whatsapp" | "email" | "slack" | "drive" | "other";

const PLAN_FOR_RANGE: Record<ClientRange, string> = {
  "1-2": "Solo",
  "3-5": "Starter",
  "6-15": "Pro",
  "16+": "Studio",
};

/**
 * Three quick questions instead of a feature tour. The answers shape the next
 * screen (plan suggestion) and tell us who signs up and where approvals happen today.
 */
export default function OnboardingPage() {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [clientRange, setClientRange] = useState<ClientRange | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [saving, setSaving] = useState(false);

  const roles: { value: Role; label: string; hint: string }[] = [
    { value: "freelancer", label: tr("Social media freelancer", "Freelance social media manager"), hint: tr("Você cuida dos clientes sozinho(a)", "You handle clients on your own") },
    { value: "agency", label: tr("Agência", "Agency"), hint: tr("Um time atendendo várias marcas", "A team serving several brands") },
    { value: "in_house", label: tr("Marketing interno", "In-house marketing"), hint: tr("Você aprova conteúdo da sua própria empresa", "You approve content for your own company") },
  ];
  const ranges: ClientRange[] = ["1-2", "3-5", "6-15", "16+"];
  const channelOptions: { value: Channel; label: string }[] = [
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: tr("E-mail", "Email") },
    { value: "slack", label: "Slack" },
    { value: "drive", label: tr("Comentários no Drive", "Drive comments") },
    { value: "other", label: tr("Outro", "Other") },
  ];

  const finish = async (answers: boolean) => {
    if (saving) return;
    setSaving(true);
    const profile = answers
      ? { ...(role && { role }), ...(clientRange && { clientRange }), ...(channels.length && { channels }) }
      : {};
    if (answers) trackEvent("onboarding_profile", { role, client_range: clientRange, channels: channels.join(",") });
    try {
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
    } catch {
      // Continue even if the API call fails
    }
    router.push(answers ? "/dashboard/clients/new" : "/dashboard");
  };

  const toggleChannel = (value: Channel) =>
    setChannels((current) => (current.includes(value) ? current.filter((c) => c !== value) : [...current, value]));

  const optionClass = (selected: boolean) =>
    `w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
    }`;

  const questions = [
    {
      title: tr("O que descreve você melhor?", "What best describes you?"),
      canNext: role !== null,
      body: (
        <div className="space-y-3" role="radiogroup">
          {roles.map((option) => (
            <button key={option.value} type="button" role="radio" aria-checked={role === option.value} className={optionClass(role === option.value)} onClick={() => setRole(option.value)}>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-sm text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: role === "in_house"
        ? tr("Quantas marcas ou contas você aprova?", "How many brands or accounts do you approve?")
        : tr("Quantos clientes você atende hoje?", "How many clients do you manage today?"),
      canNext: clientRange !== null,
      body: (
        <div className="grid grid-cols-2 gap-3" role="radiogroup">
          {ranges.map((range) => (
            <button key={range} type="button" role="radio" aria-checked={clientRange === range} className={`${optionClass(clientRange === range)} text-center text-lg font-semibold tabular-nums`} onClick={() => setClientRange(range)}>
              {range}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: tr("Onde seus clientes aprovam conteúdo hoje?", "Where do your clients approve content today?"),
      hint: tr("Marque todos que valem.", "Pick all that apply."),
      canNext: channels.length > 0,
      body: (
        <div className="grid grid-cols-2 gap-3">
          {channelOptions.map((option) => {
            const selected = channels.includes(option.value);
            return (
              <button key={option.value} type="button" aria-pressed={selected} className={`${optionClass(selected)} flex items-center gap-2 font-medium`} onClick={() => toggleChannel(option.value)}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      ),
    },
  ];

  const isSummary = step === questions.length;
  const question = questions[step];
  const suggestedPlan = clientRange ? PLAN_FOR_RANGE[clientRange] : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="flex justify-center gap-2 mb-10" aria-hidden>
          {[...questions, null].map((_, index) => (
            <span
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === step ? "w-8 bg-primary" : index < step ? "w-2 bg-primary/50" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        {isSummary ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
              <Check className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold tracking-tight">{tr("Tudo pronto", "You're all set")}</h1>
              <p className="text-muted-foreground leading-relaxed">
                {tr(
                  "Seu teste de 15 dias já começou. Comece pelo primeiro cliente: você adiciona o conteúdo e envia um link para ele aprovar, sem criar conta.",
                  "Your 15-day trial has started. Begin with your first client: add the content and send them one link to approve, no account needed."
                )}
              </p>
              {suggestedPlan && (
                <p className="text-sm text-muted-foreground">
                  {tr(
                    `Pelo número de clientes, o plano ${suggestedPlan} deve servir quando o teste acabar.`,
                    `Based on your client count, the ${suggestedPlan} plan should fit when the trial ends.`
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tr("Voltar", "Back")}
              </Button>
              <Button size="lg" onClick={() => finish(true)} disabled={saving}>
                {tr("Adicionar meu primeiro cliente", "Add my first client")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground tabular-nums">
                {tr(`Pergunta ${step + 1} de ${questions.length}`, `Question ${step + 1} of ${questions.length}`)}
              </p>
              <h1 className="text-2xl font-bold tracking-tight">{question.title}</h1>
              {question.hint && <p className="text-sm text-muted-foreground">{question.hint}</p>}
            </div>
            {question.body}
            <div className="flex items-center justify-between pt-4">
              {step === 0 ? (
                <Button variant="ghost" onClick={() => finish(false)} className="text-muted-foreground" disabled={saving}>
                  {tr("Pular", "Skip")}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {tr("Voltar", "Back")}
                </Button>
              )}
              <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!question.canNext}>
                {tr("Próximo", "Next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
