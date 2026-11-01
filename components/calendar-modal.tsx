"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarView } from "@/components/calendar-view";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import type { Post } from "./post-slide";

interface CalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: Post[];
  onSelectDay: (date: Date) => void;
  onCreateOnDay?: (date: Date) => void;
  currentMonth: Date;
  isAdmin?: boolean;
}

export function CalendarModal({
  open,
  onOpenChange,
  posts,
  onSelectDay,
  onCreateOnDay,
  currentMonth,
  isAdmin = false,
}: CalendarModalProps) {
  const locale = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        data-component="calendar-modal"
        id="calendar-modal"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">
            {localizedText(locale, "Calendário", "Calendar")}
          </DialogTitle>
        </DialogHeader>

        <CalendarView
          posts={posts}
          onSelectDay={(date) => {
            onSelectDay(date);
            onOpenChange(false);
          }}
          onCreateOnDay={
            onCreateOnDay
              ? (date) => {
                  onCreateOnDay(date);
                  onOpenChange(false);
                }
              : undefined
          }
          currentMonth={currentMonth}
          isAdmin={isAdmin}
        />
      </DialogContent>
    </Dialog>
  );
}
