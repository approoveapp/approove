import { localizedText, type AppLocale } from "@/lib/locale";

export type PlanName = "free" | "solo" | "starter" | "pro" | "studio" | "enterprise";
export type LimitedResource = "clients" | "members" | "reviewers" | "aiImports";

type PlanLimits = Record<LimitedResource, number | null>;

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  // Sem trial nem assinatura: nada novo pode ser criado.
  // aiImports é por mês corrente: ~2 importações por cliente do plano.
  free: { clients: 0, members: 1, reviewers: null, aiImports: 0 },
  solo: { clients: 2, members: 1, reviewers: null, aiImports: 4 },
  starter: { clients: 5, members: 2, reviewers: null, aiImports: 10 },
  pro: { clients: 15, members: 5, reviewers: null, aiImports: 30 },
  studio: { clients: 40, members: 15, reviewers: null, aiImports: 80 },
  enterprise: { clients: null, members: null, reviewers: null, aiImports: null },
};

const planLabels: Record<PlanName, string> = {
  free: "Free",
  solo: "Solo",
  starter: "Starter",
  pro: "Pro",
  studio: "Studio",
  enterprise: "Enterprise",
};

type ResourceLabel = { singular: string; plural: string };

const resourceLabels: Record<AppLocale, Record<LimitedResource, ResourceLabel>> = {
  "pt-BR": {
    clients: { singular: "cliente", plural: "clientes" },
    members: { singular: "usuário da agência", plural: "usuários da agência" },
    reviewers: { singular: "revisor ativo", plural: "revisores ativos" },
    aiImports: { singular: "importação com IA por mês", plural: "importações com IA por mês" },
  },
  en: {
    clients: { singular: "client", plural: "clients" },
    members: { singular: "agency user", plural: "agency users" },
    reviewers: { singular: "active reviewer", plural: "active reviewers" },
    aiImports: { singular: "AI import per month", plural: "AI imports per month" },
  },
};

export function normalizePlan(plan: string | null | undefined): PlanName {
  if (plan === "agency") return "pro";
  if (
    plan === "solo" ||
    plan === "starter" ||
    plan === "pro" ||
    plan === "studio" ||
    plan === "enterprise"
  ) {
    return plan;
  }
  return "free";
}

export function getPlanLimit(plan: string | null | undefined, resource: LimitedResource) {
  return PLAN_LIMITS[normalizePlan(plan)][resource];
}

export function planAllows(
  plan: string | null | undefined,
  resource: LimitedResource,
  currentCount: number,
  add = 1
) {
  const limit = getPlanLimit(plan, resource);
  return limit === null || currentCount + add <= limit;
}

export function planLimitResponse(
  plan: string | null | undefined,
  resource: LimitedResource,
  currentCount: number,
  locale: AppLocale
) {
  const normalizedPlan = normalizePlan(plan);
  const limit = getPlanLimit(normalizedPlan, resource);
  const labels = resourceLabels[locale][resource];
  const unit = limit === 1 ? labels.singular : labels.plural;
  const planLabel = planLabels[normalizedPlan];

  return {
    error: localizedText(
      locale,
      `Seu plano ${planLabel} permite até ${limit} ${unit}.`,
      `Your ${planLabel} plan allows up to ${limit} ${unit}.`
    ),
    code: "PLAN_LIMIT_REACHED" as const,
    plan: normalizedPlan,
    resource,
    current: currentCount,
    limit,
    upgradePath: "/dashboard/settings",
  };
}
