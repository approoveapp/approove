import type { AppLocale } from "@/lib/locale";

const OPTIONS: { locale: AppLocale; param: string; label: string }[] = [
  { locale: "en", param: "en", label: "English" },
  { locale: "pt-BR", param: "pt", label: "Português" },
];

/**
 * Plain links on purpose: a full request lets the proxy store the choice in a
 * cookie before the page renders again.
 */
export function LanguageSwitch({
  locale,
  className,
  activeClassName = "font-bold opacity-100",
  idleClassName = "opacity-60 hover:opacity-100",
}: {
  locale: AppLocale;
  className?: string;
  activeClassName?: string;
  idleClassName?: string;
}) {
  return (
    <nav aria-label={locale === "pt-BR" ? "Idioma" : "Language"} className={`flex items-center gap-3 ${className ?? ""}`}>
      {OPTIONS.map((option) =>
        option.locale === locale ? (
          <span key={option.param} aria-current="true" className={activeClassName}>
            {option.label}
          </span>
        ) : (
          <a
            key={option.param}
            href={`?lang=${option.param}`}
            hrefLang={option.locale}
            lang={option.locale}
            className={`transition-opacity ${idleClassName}`}
          >
            {option.label}
          </a>
        )
      )}
    </nav>
  );
}
