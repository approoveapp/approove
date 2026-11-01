"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Plus, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface EmptyDaySlideProps {
  date: Date;
  isAdmin: boolean;
  onAddPost?: () => void;
}

export function EmptyDaySlide({ date, isAdmin, onAddPost }: EmptyDaySlideProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const dateLabel =
    locale === "pt-BR"
      ? format(date, "dd 'de' MMMM, yyyy", { locale: ptBR })
      : format(date, "MMMM d, yyyy");

  return (
    <div className="h-screen w-full flex flex-col pt-16" data-component="empty-day-slide">
      <div className="border-b bg-background/95 px-6 py-3">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{dateLabel}</span>
          </div>
          {isAdmin && onAddPost && (
            <div className="flex gap-2 ml-4 pl-4 border-l">
              <Button size="sm" variant="outline" onClick={onAddPost}>
                <Plus className="h-4 w-4 mr-1" /> {tr("Novo post", "New post")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">{tr("Nenhuma publicação neste dia", "No posts on this day")}</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? tr(
                    "Clique em “+ Novo post” para criar uma publicação nesta data.",
                    "Click “+ New post” to create a post on this date."
                  )
                : tr(
                    "Ainda não há conteúdo para revisar neste dia.",
                    "There's nothing to review on this day yet."
                  )}
            </p>
          </div>
          {isAdmin && onAddPost && (
            <Button onClick={onAddPost} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> {tr("Novo post", "New post")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
