import type { ReactNode } from "react";
import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata(
  "Calendário",
  "Calendário de aprovação Approove.",
  { absoluteTitle: true }
);

export default function ClientCalendarLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
