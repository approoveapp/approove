"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/components/locale-provider";
import { localizedText, type AppLocale } from "@/lib/locale";
import type { Comment } from "./post-slide";

interface CommentThreadProps {
  comments: Comment[];
  onAddComment: (text: string) => void;
  canComment?: boolean;
}

function getCommentAuthorLabel(comment: Comment, locale: AppLocale): string {
  if (comment.authorName?.trim()) return comment.authorName.trim();
  return comment.author === "agency"
    ? localizedText(locale, "Agência", "Agency")
    : localizedText(locale, "Cliente", "Client");
}

export function CommentThread({
  comments,
  onAddComment,
  canComment = true,
}: CommentThreadProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [newComment, setNewComment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment("");
    }
  };

  return (
    <Card className="h-full flex flex-col" data-component="comment-thread">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{tr("Comentários", "Comments")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3" data-section="comments-list">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {tr("Nenhum comentário ainda", "No comments yet")}
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 rounded-lg ${
                  comment.author === "agency"
                    ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                    : "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                }`}
                data-comment-id={comment.id}
                data-author={comment.author}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">
                    {getCommentAuthorLabel(comment, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), "dd/MM/yy HH:mm", {
                      locale: locale === "pt-BR" ? ptBR : undefined,
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground">{comment.text}</p>
              </div>
            ))
          )}
        </div>

        {canComment && (
          <form onSubmit={handleSubmit} className="space-y-2" data-section="new-comment-form">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={tr("Adicionar comentário...", "Add a comment...")}
                className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                data-input="comment-text"
              />
              <Button type="submit" size="icon" disabled={!newComment.trim()} data-action="submit-comment">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
