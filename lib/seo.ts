import type { Metadata } from "next";
import type { AppLocale } from "@/lib/locale";

/** Páginas que o Google deve indexar. Qualquer outra rota da app fica de fora. */
export const INDEXABLE_PATHS = [
  "/",
  "/en",
  "/como-funciona",
  "/en/how-it-works",
  "/precos",
  "/en/pricing",
  "/termos",
  "/privacidade",
] as const;

/**
 * Prefixo no robots.txt. /login e /signup ficam de fora de propósito:
 * o Google precisa rastrea-los para honrar o noindex (estão linkados na home).
 */
export const ROBOTS_DISALLOW_PATHS = [
  "/dashboard",
  "/onboarding",
  "/convite",
  "/subscribe",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/c/",
  "/api/",
] as const;

/** Matchers do `headers()` no next.config — inclui login/signup (200 públicos). */
export const NOINDEX_HEADER_SOURCES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/convite",
  "/onboarding",
  "/subscribe",
  "/dashboard/:path*",
  "/c/:path*",
] as const;

export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export const INDEX_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
};

export function marketingPageMetadata({
  locale,
  baseUrl,
  pathPt,
  pathEn,
  titlePt,
  titleEn,
  descriptionPt,
  descriptionEn,
}: {
  locale: AppLocale;
  baseUrl: string;
  pathPt: string;
  pathEn: string;
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
}): Metadata {
  const isPt = locale === "pt-BR";
  const canonicalPath = isPt ? pathPt : pathEn;
  const canonical = `${baseUrl}${canonicalPath === "/" ? "/" : canonicalPath}`;
  const title = isPt ? titlePt : titleEn;
  const description = isPt ? descriptionPt : descriptionEn;
  const ptUrl = `${baseUrl}${pathPt === "/" ? "/" : pathPt}`;
  const enUrl = `${baseUrl}${pathEn}`;

  return {
    title: { absolute: title },
    description,
    robots: INDEX_ROBOTS,
    alternates: {
      canonical,
      languages: {
        "pt-BR": ptUrl,
        en: enUrl,
        "x-default": ptUrl,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Approove",
      title,
      description,
      locale: isPt ? "pt_BR" : "en_US",
      alternateLocale: isPt ? ["en_US"] : ["pt_BR"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function marketingHomeMetadata(locale: AppLocale, baseUrl: string): Metadata {
  return marketingPageMetadata({
    locale,
    baseUrl,
    pathPt: "/",
    pathEn: "/en",
    titlePt: "Approove - Aprovação de conteúdo para agências",
    titleEn: "Content approval software for agencies | Approove",
    descriptionPt:
      "Organize o calendário editorial, envie o conteúdo para revisão e saiba exatamente o que o cliente aprovou. Sem aprovação espalhada no WhatsApp, e-mail ou Drive.",
    descriptionEn:
      "Content approval software for agencies. Organize the editorial calendar, send work for review, and know exactly what the client approved — without WhatsApp, email, or Drive.",
  });
}

export function privatePageMetadata(
  title: string,
  description: string,
  options?: { absoluteTitle?: boolean }
): Metadata {
  return {
    title: options?.absoluteTitle ? { absolute: title } : title,
    description,
    robots: NOINDEX_ROBOTS,
  };
}

const AUTH_COPY: Record<string, { title: [string, string]; description: [string, string] }> = {
  "/login": {
    title: ["Entrar", "Log in"],
    description: ["Acesse sua conta Approove.", "Access your Approove account."],
  },
  "/signup": {
    title: ["Criar conta", "Sign up"],
    description: ["Crie sua conta Approove.", "Create your Approove account."],
  },
  "/forgot-password": {
    title: ["Recuperar senha", "Forgot password"],
    description: ["Redefina a senha da sua conta Approove.", "Reset your Approove account password."],
  },
  "/reset-password": {
    title: ["Redefinir senha", "Reset password"],
    description: ["Escolha uma nova senha para o Approove.", "Choose a new password for Approove."],
  },
  "/invite": {
    title: ["Convite", "Invite"],
    description: ["Aceite o convite para o Approove.", "Accept your Approove invite."],
  },
};

export const AUTH_COPY_PATHS = Object.keys(AUTH_COPY);

export function authMetadataForPath(pathname: string, locale: AppLocale): Metadata {
  const isPt = locale === "pt-BR";
  const copy = AUTH_COPY[pathname] ?? {
    title: ["Approove", "Approove"],
    description: ["Acesso à conta Approove.", "Approove account access."],
  };

  return privatePageMetadata(
    isPt ? copy.title[0] : copy.title[1],
    isPt ? copy.description[0] : copy.description[1]
  );
}

export function buildLlmsTxt(baseUrl: string): string {
  return [
    "# Approove",
    "",
    "> Client content-approval workspace for agencies and marketing teams. Editorial calendar, client review by link, and a record of who approved what — creative and caption.",
    "",
    "## What it is",
    "",
    "Approove is a web app where an agency organizes posts per client, reviews internally, then sends the client a link to review and approve. The client does not need an account on the shared link. Approval is tied to the current creative and caption; if either changes, the previous approval no longer stands.",
    "",
    "Portuguese (Brazil): espaço de aprovação de conteúdo para agências. Calendário editorial, revisão do cliente e registro do que foi aprovado. Sem aprovação espalhada no WhatsApp, e-mail ou Drive.",
    "",
    "## What it is not",
    "",
    "- Not a social-network publisher. It does not post to Instagram, Facebook, LinkedIn, or TikTok.",
    "- Not a generic project-management tool. Internal stages exist only to keep unfinished work off the client calendar.",
    "",
    "## Who it is for",
    "",
    "Freelancers, studios, and agencies that send calendars to clients for approval.",
    "",
    "## How approval works",
    "",
    "1. The agency prepares posts (images, carousels, MP4/MOV, captions).",
    "2. Internal stages stay inside the agency until a post is ready for the client.",
    "3. The client opens a link on phone or desktop, comments, pins points on images, requests changes, or approves.",
    "4. Roles: viewer, reviewer, approver. Named reviewers can be invited and revoked.",
    "5. Approove records who approved, when, and which version was current.",
    "",
    "## Pricing",
    "",
    "15-day trial, no credit card. Paid plans Solo, Starter, Pro, and Studio. Limits scale by clients, agency seats, and reviewers. Posts are unlimited. Billing is monthly (BRL in Brazil, USD otherwise). Cancel in the billing portal.",
    "",
    "## Public pages",
    "",
    `- Home (pt-BR, canonical): ${baseUrl}/`,
    `- Home (English): ${baseUrl}/en`,
    `- How it works: ${baseUrl}/como-funciona`,
    `- How it works (English): ${baseUrl}/en/how-it-works`,
    `- Pricing: ${baseUrl}/precos`,
    `- Pricing (English): ${baseUrl}/en/pricing`,
    `- Terms: ${baseUrl}/termos`,
    `- Privacy: ${baseUrl}/privacidade`,
    "",
    "## Do not index",
    "",
    "App surfaces (/dashboard, /login, /signup, /onboarding, /subscribe, /invite, /convite) and client galleries (/c/*) are private. Share links may include a token; they must not appear in search results.",
    "",
    "## Contact",
    "",
    "contato@approove.app",
    "",
  ].join("\n");
}
