import Link from "next/link";
import { Wordmark } from "@/components/landing/ui";
import { localizedText, type AppLocale } from "@/lib/locale";
import { MARKETING_PATHS, marketingPath } from "@/lib/marketing-routes";

export function LandingNavbar({
  locale,
  languageHref = MARKETING_PATHS.home,
  aiImport = false,
}: {
  locale: AppLocale;
  languageHref?: { "pt-BR": string; en: string };
  aiImport?: boolean;
}) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const home = marketingPath("home", locale);
  const how = marketingPath("how", locale);
  const pricing = marketingPath("pricing", locale);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ backgroundColor: "rgba(244,233,225,0.85)", borderColor: "rgba(27,25,23,0.1)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href={home} aria-label={tr("Approove - página inicial", "Approove - home")} className="text-xl">
          <Wordmark />
        </Link>
        {/* Os links só cabem a partir de lg; entre lg e xl o espaçamento aperta para não empurrar o CTA. */}
        <nav className="hidden items-center gap-5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] lg:flex xl:gap-8 xl:tracking-[0.2em]">
          {[
            [how, tr("Como funciona", "How it works")],
            [`${how}#aprovacao`, tr("Aprovação", "Approval")],
            ...(aiImport ? [[`${home}#importar`, tr("Importação", "Import")]] : []),
            [`${home}#funcionalidades`, tr("Funcionalidades", "Features")],
            [pricing, tr("Preços", "Pricing")],
            [`${home}#faq`, "FAQ"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="relative opacity-60 transition-opacity duration-200 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:opacity-100 hover:after:scale-x-100"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <nav
            aria-label={tr("Idioma", "Language")}
            className="mr-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em]"
          >
            <Link
              href={languageHref["pt-BR"]}
              hrefLang="pt-BR"
              lang="pt-BR"
              aria-current={locale === "pt-BR" ? "page" : undefined}
              className={locale === "pt-BR" ? "opacity-100" : "opacity-40 transition-opacity hover:opacity-70"}
            >
              PT
            </Link>
            <span className="opacity-30" aria-hidden>
              /
            </span>
            <Link
              href={languageHref.en}
              hrefLang="en"
              lang="en"
              aria-current={locale === "en" ? "page" : undefined}
              className={locale === "en" ? "opacity-100" : "opacity-40 transition-opacity hover:opacity-70"}
            >
              EN
            </Link>
          </nav>
          <Link
            href="/login"
            className="hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70 sm:inline-flex"
          >
            {tr("Entrar", "Log in")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center whitespace-nowrap rounded-full bg-[#1B1917] px-5 py-2.5 text-sm font-semibold text-[#F4E9E1] transition-colors duration-300 hover:bg-[#0072E3] hover:text-white"
          >
            {tr("Testar grátis", "Start free trial")}
          </Link>
        </div>
      </div>
    </header>
  );
}
