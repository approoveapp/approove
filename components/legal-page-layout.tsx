import Link from "next/link";
import { localizedText, type AppLocale } from "@/lib/locale";

interface LegalPageLayoutProps {
  title: string;
  updatedAt: string;
  locale: AppLocale;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, updatedAt, locale, children }: LegalPageLayoutProps) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Approove
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {tr("Voltar ao início", "Back to home")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("Última atualização", "Last updated")}: {updatedAt}
        </p>

        <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-foreground">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
