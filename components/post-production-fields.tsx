"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  PRODUCTION_STAGES,
  getProductionStageLabel,
} from "@/lib/production-stages";
import { useLocale } from "@/components/locale-provider";
import { localizedText, type AppLocale } from "@/lib/locale";

const PRODUCTION_STAGE_LABELS_EN: Record<string, string> = {
  draft_copy: "Copy in production",
  waiting_design: "Waiting on design",
  internal_review: "Internal review",
  ready_for_client: "Ready for client",
};

export function getLocalizedProductionStageLabel(stage: string, locale: AppLocale): string {
  const portuguese = getProductionStageLabel(stage);
  return localizedText(locale, portuguese, PRODUCTION_STAGE_LABELS_EN[stage] ?? portuguese);
}

export interface TeamMemberOption {
  user: { id: string; name: string | null; email: string };
}

interface PostProductionFieldsProps {
  stage: string;
  assigneeId: string;
  note: string;
  members: TeamMemberOption[];
  onStageChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  idPrefix?: string;
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PostProductionFields({
  stage,
  assigneeId,
  note,
  members,
  onStageChange,
  onAssigneeChange,
  onNoteChange,
  idPrefix = "post",
}: PostProductionFieldsProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-stage`}>{tr("Etapa de produção", "Production stage")}</Label>
          <select
            id={`${idPrefix}-stage`}
            className={selectClass}
            value={stage}
            onChange={(e) => onStageChange(e.target.value)}
          >
            {PRODUCTION_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {getLocalizedProductionStageLabel(s.value, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-assignee`}>{tr("Responsável", "Assignee")}</Label>
          <select
            id={`${idPrefix}-assignee`}
            className={selectClass}
            value={assigneeId}
            onChange={(e) => onAssigneeChange(e.target.value)}
          >
            <option value="">{tr("Sem responsável", "Unassigned")}</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-note`}>{tr("Nota para o responsável (opcional)", "Note for the assignee (optional)")}</Label>
        <Input
          id={`${idPrefix}-note`}
          placeholder={tr("Ex.: copy aprovada, seguir com layout do feed", "E.g. copy approved, move on to the feed layout")}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
    </div>
  );
}
