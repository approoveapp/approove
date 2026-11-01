"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { PostProductionFields, type TeamMemberOption } from "@/components/post-production-fields";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface TeamMember extends TeamMemberOption {}

interface PostHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  initialStage: string;
  initialAssigneeId: string | null;
  members: TeamMember[];
  onSuccess: () => void;
}

export function PostHandoffDialog({
  open,
  onOpenChange,
  postId,
  initialStage,
  initialAssigneeId,
  members,
  onSuccess,
}: PostHandoffDialogProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [stage, setStage] = useState(initialStage);
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setStage(initialStage);
      setAssigneeId(initialAssigneeId ?? "");
      setNote("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/handoff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionStage: stage,
          assigneeId: assigneeId || null,
          handoffNote: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : tr("Erro ao transferir tarefa", "Failed to hand off task"));
        return;
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      setError(tr("Erro de conexão. Tente novamente.", "Connection error. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Transferir tarefa", "Hand off task")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <PostProductionFields
            stage={stage}
            assigneeId={assigneeId}
            note={note}
            members={members}
            onStageChange={setStage}
            onAssigneeChange={setAssigneeId}
            onNoteChange={setNote}
            idPrefix="handoff"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr("Transferir", "Hand off")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
