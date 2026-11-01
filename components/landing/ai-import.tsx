import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Film, FileSpreadsheet, FileText, ImageIcon, Sparkles } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { MaskedWords } from "@/components/landing/masked-words";
import { Eyebrow, SectionHeading } from "@/components/landing/ui";
import { ProductChrome } from "@/components/landing/product-frames";
import { amber, blue, coral, cream, green, ink, paper, purple } from "@/components/landing/tokens";
import { localizedText, type AppLocale } from "@/lib/locale";

const muted = "rgba(27,25,23,0.5)";

function FileStack({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const files = [
    { name: tr("pauta-novembro.xlsx", "november-plan.xlsx"), Icon: FileSpreadsheet, color: green },
    { name: tr("briefing-cliente.pdf", "client-brief.pdf"), Icon: FileText, color: coral },
    { name: tr("legendas-aprovadas.docx", "approved-captions.docx"), Icon: FileText, color: blue },
    { name: "torra_1.jpg · torra_2.jpg · torra_3.jpg", Icon: ImageIcon, color: purple },
    { name: tr("reels-lancamento.mp4", "launch-reel.mp4"), Icon: Film, color: amber },
  ];

  return (
    <div className="rounded-3xl p-5 sm:p-6" style={{ backgroundColor: paper, color: ink }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: muted }}>
        {tr("O que a agência já tem", "What the agency already has")}
      </p>
      <ul className="mt-4 space-y-2">
        {files.map(({ name, Icon, color }, i) => (
          <li
            key={name}
            className="lp-activity-in flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: "rgba(27,25,23,0.1)", animationDelay: `${i * 90}ms` }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: color }}>
              <Icon className="h-4 w-4 text-white" />
            </span>
            <span className="min-w-0 truncate">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalendarResult({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const posts = [
    {
      date: tr("03 nov", "Nov 03"),
      time: "12:00",
      channel: "Instagram",
      format: tr("Carrossel · 3 slides", "Carousel · 3 slides"),
      title: tr("Do grão à xícara", "From bean to cup"),
      stage: tr("Revisão interna", "Internal review"),
      stageColor: amber,
      thumb: `linear-gradient(135deg, #3b2416, #7a4a2a)`,
      video: false,
    },
    {
      date: tr("04 nov", "Nov 04"),
      time: "09:00",
      channel: "LinkedIn",
      format: "Post",
      title: tr("Bastidores na fazenda", "Behind the scenes at the farm"),
      stage: tr("Revisão interna", "Internal review"),
      stageColor: amber,
      thumb: `linear-gradient(135deg, #2f4a2a, #5f8a4f)`,
      video: false,
    },
    {
      date: tr("06 nov", "Nov 06"),
      time: "18:00",
      channel: "Instagram",
      format: "Reels",
      title: tr("Lançamento Safra 26", "Harvest 26 launch"),
      stage: tr("Revisão interna", "Internal review"),
      stageColor: amber,
      thumb: `linear-gradient(135deg, ${coral}, #c8642a)`,
      video: true,
    },
    {
      date: tr("10 nov", "Nov 10"),
      time: "09:00",
      channel: "LinkedIn",
      format: "Post",
      title: tr("Workshop de preparo", "Brewing workshop"),
      stage: tr("Copy em produção", "Copy in production"),
      stageColor: purple,
      thumb: null,
      video: false,
    },
  ];

  return (
    <ProductChrome url="approove.app/dashboard/clients/cafe-aurora">
      <div className="p-4 sm:p-5" style={{ color: ink }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-extrabold">{tr("8 publicações encontradas", "8 posts found")}</p>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ backgroundColor: "rgba(255,178,0,0.18)", color: "#8a5a00" }}
          >
            {tr("2 avisos para conferir", "2 notes to check")}
          </span>
        </div>
        <ul className="mt-4 space-y-2">
          {posts.map((post, i) => (
            <li
              key={post.title}
              className="lp-activity-in flex items-center gap-3 rounded-2xl border p-2.5"
              style={{ borderColor: "rgba(27,25,23,0.08)", backgroundColor: "#fff", animationDelay: `${400 + i * 120}ms` }}
            >
              <div className="w-12 shrink-0 text-center">
                <p className="text-[11px] font-extrabold leading-tight">{post.date}</p>
                <p className="text-[10px] font-semibold" style={{ color: muted }}>
                  {post.time}
                </p>
              </div>
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={{ background: post.thumb ?? "rgba(27,25,23,0.06)" }}
              >
                {post.thumb ? (
                  post.video && <Film className="absolute bottom-1 left-1 h-3 w-3 text-white" />
                ) : (
                  <ImageIcon className="h-4 w-4" style={{ color: "rgba(27,25,23,0.3)" }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold">{post.title}</p>
                <p className="truncate text-[11px] font-semibold" style={{ color: muted }}>
                  {post.channel} · {post.format}
                </p>
              </div>
              <span
                className="hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex"
                style={{ backgroundColor: "rgba(27,25,23,0.05)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: post.stageColor }} />
                {post.stage}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold" style={{ color: muted }}>
            {tr("Você revisa e edita antes de criar.", "You review and edit before anything is created.")}
          </p>
          <span className="shrink-0 rounded-full px-4 py-2 text-[11px] font-bold text-white" style={{ backgroundColor: ink }}>
            {tr("Criar 8 publicações", "Create 8 posts")}
          </span>
        </div>
      </div>
    </ProductChrome>
  );
}

export function LandingAiImport({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const points = [
    {
      title: tr("Datas, horários e canais", "Dates, times, and channels"),
      text: tr(
        "Lidos da planilha, do PDF ou do documento, mesmo quando a legenda está em outro arquivo.",
        "Read from the spreadsheet, the PDF, or the doc, even when the caption lives in another file."
      ),
    },
    {
      title: tr("Legendas exatamente como estão", "Captions exactly as written"),
      text: tr(
        "A IA transcreve, não escreve. Emojis, quebras de linha e hashtags chegam intactos.",
        "The AI transcribes, it doesn’t write. Emojis, line breaks, and hashtags arrive intact."
      ),
    },
    {
      title: tr("Cada arte no post certo", "Every creative on the right post"),
      text: tr(
        "Pelo nome do arquivo, pela pauta ou pelo que aparece na imagem. Carrossel na ordem, vídeo incluído.",
        "By file name, by the plan, or by what’s in the image. Carousels in order, videos included."
      ),
    },
    {
      title: tr("Nada entra sem você conferir", "Nothing goes in unchecked"),
      text: tr(
        "Datas em conflito e arquivos faltando viram avisos. Você ajusta e só então os posts são criados.",
        "Date conflicts and missing files show up as notes. You adjust, and only then are posts created."
      ),
    },
  ];

  return (
    <section id="importar" className="scroll-mt-16" style={{ backgroundColor: blue, color: "#fff" }}>
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.15em]"
            style={{ backgroundColor: cream, color: ink }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: blue }} />
            {tr("Novo", "New")}
          </span>
          <Eyebrow light>{tr("Importação com IA", "AI import")}</Eyebrow>
        </div>
        <Reveal bare>
          <SectionHeading>
            <MaskedWords
              text={tr("Já tem o calendário pronto? Traga ele inteiro.", "Already have a calendar? Bring all of it.")}
              accents={locale === "pt-BR" ? { "inteiro.": amber } : { "all": amber, "of": amber, "it.": amber }}
            />
          </SectionHeading>
        </Reveal>
        <p className="mt-6 max-w-2xl text-lg font-medium leading-snug" style={{ color: "rgba(255,255,255,0.78)" }}>
          {tr(
            "Envie a planilha de pauta, o briefing e as artes. Em cerca de um minuto o Approove monta o calendário do cliente com datas, legendas e artes nos lugares certos. Sem redigitar nada.",
            "Upload the content plan, the brief, and the creatives. In about a minute, Approove builds the client’s calendar with dates, captions, and creatives in the right places. No retyping."
          )}
        </p>

        <div className="mt-14 grid grid-cols-1 items-center gap-6 lg:grid-cols-[0.8fr,auto,1.2fr] lg:gap-8">
          <Reveal>
            <FileStack locale={locale} />
          </Reveal>
          <Reveal delay={120} className="flex flex-col items-center gap-2">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-[0_12px_30px_-10px_rgba(0,0,0,0.45)]"
              style={{ backgroundColor: ink }}
            >
              <Sparkles className="h-6 w-6" style={{ color: amber }} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {tr("~1 minuto", "~1 minute")}
            </span>
            <ArrowRight className="hidden h-5 w-5 lg:block" style={{ color: "rgba(255,255,255,0.7)" }} />
            <ArrowDown className="h-5 w-5 lg:hidden" style={{ color: "rgba(255,255,255,0.7)" }} />
          </Reveal>
          <Reveal delay={200}>
            <CalendarResult locale={locale} />
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {points.map(({ title, text }, i) => (
            <Reveal key={title} delay={i * 70}>
              <div className="h-full rounded-3xl border p-6" style={{ borderColor: "rgba(255,255,255,0.22)" }}>
                <span className="text-sm font-extrabold" style={{ color: amber }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-extrabold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-snug" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm font-semibold tracking-tight transition-colors duration-300 hover:bg-[#1B1917] hover:text-[#F4E9E1]"
            style={{ backgroundColor: cream, color: ink }}
          >
            {tr("Testar com o meu calendário", "Try it with my calendar")}
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
            {tr(
              "Incluída no teste grátis de 15 dias. PDF, DOCX, XLSX, CSV, imagens e vídeos.",
              "Included in the 15-day free trial. PDF, DOCX, XLSX, CSV, images, and videos."
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
