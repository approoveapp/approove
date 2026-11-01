import { Eyebrow } from "@/components/landing/ui";

export function MarketingPageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mx-auto max-w-7xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-6 max-w-4xl text-[clamp(2.4rem,6vw,5.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
        {title}
      </h1>
      <p className="mt-8 max-w-2xl text-lg font-medium leading-snug" style={{ color: "rgba(27,25,23,0.65)" }}>
        {description}
      </p>
    </header>
  );
}
