"use client";

import { useState, useMemo, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addYears,
  subYears,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
} from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import type { Post } from "./post-slide";

export interface CalendarViewProps {
  posts: Post[];
  onSelectDay: (date: Date) => void;
  onCreateOnDay?: (date: Date) => void;
  currentMonth: Date;
  isAdmin?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

// `key` keeps the original Portuguese value used in the data-weekday attribute.
const WEEKDAYS = [
  { key: "Dom", pt: "Dom", en: "Sun" },
  { key: "Seg", pt: "Seg", en: "Mon" },
  { key: "Ter", pt: "Ter", en: "Tue" },
  { key: "Qua", pt: "Qua", en: "Wed" },
  { key: "Qui", pt: "Qui", en: "Thu" },
  { key: "Sex", pt: "Sex", en: "Fri" },
  { key: "Sáb", pt: "Sáb", en: "Sat" },
] as const;

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function CalendarView({
  posts,
  onSelectDay,
  onCreateOnDay,
  currentMonth: initialMonth,
  isAdmin = false,
  title,
  subtitle,
  className,
}: CalendarViewProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  useEffect(() => {
    setViewMonth(initialMonth);
  }, [initialMonth]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { locale: ptBR });
    const end = endOfWeek(endOfMonth(viewMonth), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const postsOnDay = (day: Date) => {
    return posts.filter((post) =>
      isSameDay(new Date(post.scheduledAt), day)
    );
  };

  const handleDayClick = (day: Date) => {
    const dayPosts = postsOnDay(day);
    if (dayPosts.length > 0 || isAdmin) {
      onSelectDay(day);
    }
  };

  const handleAddPostToDay = (e: React.MouseEvent, day: Date) => {
    e.stopPropagation();
    onCreateOnDay?.(day);
  };

  const isCurrentViewMonth =
    viewMonth.getFullYear() === new Date().getFullYear() &&
    viewMonth.getMonth() === new Date().getMonth();

  const monthPostCount = calendarDays
    .filter((d) => d.getMonth() === viewMonth.getMonth())
    .reduce((count, day) => count + postsOnDay(day).length, 0);

  const formattedMonth = capitalizeFirst(
    locale === "pt-BR"
      ? format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR })
      : format(viewMonth, "MMMM yyyy")
  );

  return (
    <div className={className} data-component="calendar-view">
      {(title || subtitle) && (
        <div className="mb-6 text-center space-y-1">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMonth(subYears(viewMonth, 1))}
            title={tr("Ano anterior", "Previous year")}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            title={tr("Mês anterior", "Previous month")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center">
          <p className="font-semibold text-lg">{formattedMonth}</p>
          <div className="flex items-center justify-center gap-3 mt-0.5">
            {monthPostCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {monthPostCount}{" "}
                {monthPostCount === 1
                  ? tr("publicação", "post")
                  : tr("publicações", "posts")}
              </span>
            )}
            {!isCurrentViewMonth && (
              <button
                onClick={() => setViewMonth(new Date())}
                className="text-xs text-primary font-medium hover:underline"
              >
                {tr("Ir para hoje", "Go to today")}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            title={tr("Próximo mês", "Next month")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMonth(addYears(viewMonth, 1))}
            title={tr("Próximo ano", "Next year")}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-4"
        data-section="status-legend"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>{tr("Aprovado", "Approved")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>{tr("Pendente", "Pending")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>{tr("Ajustes", "Changes")}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mt-4" data-section="calendar-grid">
        {WEEKDAYS.map((day) => (
          <div
            key={day.key}
            className="text-center text-sm font-semibold text-muted-foreground p-2"
            data-weekday={day.key.toLowerCase()}
          >
            {tr(day.pt, day.en)}
          </div>
        ))}

        {calendarDays.map((day, index) => {
          const dayPosts = postsOnDay(day);
          const dayPostsCount = dayPosts.length;
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isToday = isSameDay(day, new Date());
          const isEmpty = dayPostsCount === 0;
          const canOpenEmpty = isAdmin && isEmpty && isCurrentMonth;
          const canAddMore = Boolean(onCreateOnDay) && isAdmin && !isEmpty && isCurrentMonth;

          return (
            <Button
              key={index}
              variant="outline"
              className={`group h-16 p-1 flex flex-col items-center justify-center relative ${
                !isCurrentMonth ? "opacity-30" : ""
              } ${dayPostsCount > 0 ? "border-primary border-2" : ""} ${
                isToday ? "ring-2 ring-primary ring-offset-1" : ""
              } ${
                canOpenEmpty
                  ? "hover:border-primary hover:border-dashed hover:bg-primary/5"
                  : ""
              }`}
              onClick={() => handleDayClick(day)}
              disabled={!isAdmin && isEmpty}
              data-date={format(day, "yyyy-MM-dd")}
              data-posts-count={dayPostsCount}
              data-action="select-day"
            >
              <span
                className={`text-sm ${canOpenEmpty ? "group-hover:hidden" : ""}`}
              >
                {format(day, "d")}
              </span>

              {dayPostsCount > 0 &&
                (() => {
                  const approved = dayPosts.filter(
                    (p) => p.status === "approved"
                  ).length;
                  const pending = dayPosts.filter(
                    (p) => p.status === "pending"
                  ).length;
                  const adjustments = dayPosts.filter(
                    (p) => p.status === "adjustments"
                  ).length;
                  const badges: {
                    count: number;
                    color: string;
                    label: string;
                  }[] = [];
                  if (approved > 0)
                    badges.push({
                      count: approved,
                      color: "bg-green-500",
                      label: tr("Aprovado", "Approved"),
                    });
                  if (pending > 0)
                    badges.push({
                      count: pending,
                      color: "bg-gray-500",
                      label: tr("Pendente", "Pending"),
                    });
                  if (adjustments > 0)
                    badges.push({
                      count: adjustments,
                      color: "bg-orange-500",
                      label: tr("Ajustes", "Changes"),
                    });

                  return (
                    <div
                      className="flex items-center gap-0.5 mt-0.5"
                      data-section="status-badges"
                    >
                      {badges.map((b) => (
                        <span
                          key={b.label}
                          className={`text-[10px] flex items-center justify-center rounded-full font-bold text-white ${b.color}`}
                          style={{
                            width: "18px",
                            height: "18px",
                            minWidth: "18px",
                          }}
                          title={`${b.count} ${b.label}`}
                        >
                          {b.count}
                        </span>
                      ))}
                    </div>
                  );
                })()}

              {canOpenEmpty && (
                <div className="hidden group-hover:flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-primary font-medium leading-tight">
                    {tr("Abrir", "Open")}
                  </span>
                </div>
              )}

              {canAddMore && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleAddPostToDay(e, day)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleAddPostToDay(
                        e as unknown as React.MouseEvent,
                        day
                      );
                  }}
                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20 cursor-pointer"
                  title={tr("Adicionar post neste dia", "Add a post on this day")}
                >
                  <Plus className="h-3 w-3" />
                </div>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
