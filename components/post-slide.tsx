"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Clock, ImageIcon, Info } from "lucide-react";
import { MediaThumb } from "@/components/media-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommentThread } from "./comment-thread";
import { ApprovalActivity } from "./approval-activity";
import { VersionSelector } from "./version-selector";
import { AttachmentSequenceViewer } from "./attachment-sequence-viewer";
import { resolveVersionSlides } from "@/lib/attachment-slides";
import {
  getAttachmentVersionNumbers,
  isViewingHistoricalAttachment,
  isViewingLatestApprovalPackage,
} from "@/lib/viewed-approval-package";
import { useLocale } from "@/components/locale-provider";
import { localizedText, type AppLocale } from "@/lib/locale";

export type PostStatus = "pending" | "approved" | "adjustments";

export const ATTACHMENT_TYPES: Record<string, string> = {
  post_feed: "Post Feed",
  post_stories: "Stories",
  post_linkedin: "LinkedIn",
  reels_cover: "Reels Cover",
  carousel: "Carrossel",
  other: "Outro",
};

const ATTACHMENT_TYPES_EN: Record<string, string> = {
  post_feed: "Feed Post",
  post_stories: "Stories",
  post_linkedin: "LinkedIn",
  reels_cover: "Reels Cover",
  carousel: "Carousel",
  other: "Other",
};

export function getAttachmentTypeLabels(locale: AppLocale): Record<string, string> {
  return locale === "pt-BR" ? ATTACHMENT_TYPES : ATTACHMENT_TYPES_EN;
}

export function getAttachmentTypeLabel(type: string, locale: AppLocale): string {
  return getAttachmentTypeLabels(locale)[type] ?? type;
}

export interface AnnotationPin {
  id: string;
  xPercent: number;
  yPercent: number;
  text: string;
  author: "agency" | "client";
  authorName?: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface AttachmentSlide {
  id: string;
  order: number;
  url: string;
  mediaType?: string;
  label?: string | null;
  pins?: AnnotationPin[];
}

export interface AttachmentVersion {
  id: string;
  url: string;
  version: number;
  createdAt: string;
  slides?: AttachmentSlide[];
  pins: AnnotationPin[];
}

export interface PostAttachment {
  id: string;
  type: string;
  label: string | null;
  order: number;
  versions: AttachmentVersion[];
}

export interface Comment {
  id: string;
  author: "agency" | "client";
  authorName?: string | null;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  scheduledAt: string;
  channel: string;
  title?: string;
  copyText: string;
  status: PostStatus;
  comments: Comment[];
  attachments: PostAttachment[];
  productionStage?: string;
  assigneeId?: string | null;
  handoffNote?: string | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  activity?: Array<{
    id: string;
    type: string;
    actorType: string;
    actorNameSnapshot: string;
    createdAt: string;
    invalidationReason?: string | null;
    creatives?: Array<{ versionNumber: number | null }>;
  }>;
  legacyApproval?: boolean;
}

interface PostSlideProps {
  post: Post;
  clientName: string;
  onCommentAdd: (postId: string, text: string) => void;
  onPinCreate?: (
    versionId: string,
    xPercent: number,
    yPercent: number,
    text: string,
    author: "agency" | "client",
    slideId?: string | null
  ) => void;
  onPinResolve?: (pinId: string, resolved: boolean) => void;
  onPinDelete?: (pinId: string) => void;
  dayPostIndex?: number;
  dayPostCount?: number;
  canComment?: boolean;
  canAnnotate?: boolean;
  onViewedPackageChange?: (isLatest: boolean) => void;
  onRegisterShowCurrentVersion?: (showCurrent: () => void) => void;
}

export function PostSlide({
  post,
  clientName,
  onCommentAdd,
  onPinCreate,
  onPinResolve,
  onPinDelete,
  dayPostIndex,
  dayPostCount,
  canComment = true,
  canAnnotate: canAnnotateProp,
  onViewedPackageChange,
  onRegisterShowCurrentVersion,
}: PostSlideProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [copying, setCopying] = useState(false);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);
  const [activeVersionIndex, setActiveVersionIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    setActiveAttachmentIndex(0);
    setActiveVersionIndex({});
  }, [post.id]);

  const attachments = post.attachments || [];
  const viewingLatestPackage = isViewingLatestApprovalPackage(
    attachments,
    activeVersionIndex
  );

  useEffect(() => {
    onViewedPackageChange?.(viewingLatestPackage);
  }, [viewingLatestPackage, onViewedPackageChange]);

  useEffect(() => {
    onRegisterShowCurrentVersion?.(() => setActiveVersionIndex({}));
  }, [onRegisterShowCurrentVersion]);

  const safeAttachmentIndex = attachments.length
    ? Math.min(activeAttachmentIndex, attachments.length - 1)
    : 0;
  const currentAttachment = attachments[safeAttachmentIndex];
  const rawVersionIdx = currentAttachment
    ? (activeVersionIndex[currentAttachment.id] ?? currentAttachment.versions.length - 1)
    : 0;
  const currentVersionIdx = currentAttachment
    ? Math.min(Math.max(rawVersionIdx, 0), currentAttachment.versions.length - 1)
    : 0;
  const currentVersion = currentAttachment?.versions[currentVersionIdx];
  const currentSlides = currentVersion ? resolveVersionSlides(currentVersion) : [];
  const currentImageUrl = currentSlides[0]?.url;
  const versionNumbers = getAttachmentVersionNumbers(
    currentAttachment,
    activeVersionIndex
  );
  const viewingHistoricalCreative = isViewingHistoricalAttachment(
    currentAttachment,
    activeVersionIndex
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(post.copyText);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getAttachmentLabel = (att: PostAttachment) => {
    return att.label || getAttachmentTypeLabel(att.type, locale);
  };

  return (
    <div className="min-h-screen lg:h-screen w-screen flex flex-col pt-16" data-component="post-slide" id={`post-${post.id}`}>
      {/* Info Bar */}
      <div className="relative flex items-center justify-center py-3 border-b bg-muted/30 px-6" data-section="info-bar">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="text-center" data-section="date-info">
            <p className="text-sm font-semibold">
              {locale === "pt-BR"
                ? format(new Date(post.scheduledAt), "dd 'de' MMMM, yyyy", {
                    locale: ptBR,
                  })
                : format(new Date(post.scheduledAt), "MMMM d, yyyy")}
              {dayPostCount && dayPostCount > 1 && (
                <span className="text-muted-foreground font-normal">
                  {" "}- {dayPostIndex} {tr("de", "of")} {dayPostCount}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(post.scheduledAt), "HH:mm")} • {post.channel}
            </p>
          </div>
        </div>

        {dayPostCount && dayPostCount > 1 && (
          <div className="flex items-center gap-1 ml-3">
            {Array.from({ length: dayPostCount }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === dayPostIndex
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 px-4 lg:px-6 py-4 lg:py-6 lg:pb-8 overflow-y-auto lg:overflow-hidden" data-section="main-content">
        {/* Left: Image Preview + Attachment Thumbnails */}
        <div className="flex flex-col gap-3 min-h-[50vh] lg:min-h-0 lg:overflow-hidden lg:max-h-[calc(100vh-180px)]" data-section="image-area">
          {/* Main preview */}
          <div className="relative flex-1 min-h-0 overflow-hidden bg-muted/20 rounded-lg border">
            {/* Version selector */}
            {currentAttachment && currentAttachment.versions.length > 1 && (
              <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2">
                {viewingHistoricalCreative && versionNumbers ? (
                  <div className="rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm border max-w-[70%]">
                    {tr(
                      `Vendo a versão ${versionNumbers.viewing} · A vigente é a ${versionNumbers.current}`,
                      `Viewing version ${versionNumbers.viewing} · Current version is ${versionNumbers.current}`
                    )}
                  </div>
                ) : !viewingLatestPackage ? (
                  <div className="rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm border max-w-[70%]">
                    {tr(
                      "Outro material está numa versão anterior",
                      "Another asset is on a previous version"
                    )}
                  </div>
                ) : (
                  <span />
                )}
                <VersionSelector
                  versions={currentAttachment.versions}
                  currentIndex={currentVersionIdx}
                  onSelect={(i) =>
                    setActiveVersionIndex((prev) => ({
                      ...prev,
                      [currentAttachment.id]: i,
                    }))
                  }
                />
              </div>
            )}

            {currentVersion && currentSlides[0]?.url ? (
              <AttachmentSequenceViewer
                attachmentType={currentAttachment?.type ?? "other"}
                version={currentVersion}
                canAnnotate={canAnnotateProp ?? !!onPinCreate}
                author="client"
                onPinCreate={onPinCreate}
                onPinResolve={onPinResolve}
                onPinDelete={onPinDelete}
              />
            ) : (
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ImageIcon className="h-12 w-12" />
                <p className="text-sm">{tr("Nenhum material anexado", "No creatives attached")}</p>
              </div>
            )}
          </div>

          {/* Attachment thumbnails strip */}
          {attachments.length > 0 && (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-2 overflow-x-auto pb-1" data-section="attachment-strip">
                {attachments.map((att, i) => {
                  const lastVersion = att.versions[att.versions.length - 1];
                  const hasMultipleVersions = att.versions.length > 1;
                  const slideCount = lastVersion ? resolveVersionSlides(lastVersion).length : 0;
                  const hasMultipleSlides = slideCount > 1;

                  const thumbButton = (
                    <button
                      type="button"
                      onClick={() => setActiveAttachmentIndex(i)}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${
                        i === safeAttachmentIndex
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-muted-foreground/20"
                      }`}
                    >
                      <div className="relative w-14 h-14 shrink-0">
                        {lastVersion?.url ? (
                          <MediaThumb
                            url={lastVersion.url}
                            alt={getAttachmentLabel(att)}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        {hasMultipleVersions && (
                          <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-background/95 border shadow-sm">
                            <Info className="h-2.5 w-2.5 text-muted-foreground" />
                          </span>
                        )}
                        {hasMultipleSlides && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-background/95 border px-1 text-[9px] font-medium">
                            {slideCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium max-w-[60px] truncate">
                        {getAttachmentLabel(att)}
                      </span>
                    </button>
                  );

                  return (
                    <div key={att.id} className="flex-shrink-0">
                      {hasMultipleVersions ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{thumbButton}</TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {tr(
                              `${att.versions.length} versões disponíveis - selecione no preview para alternar`,
                              `${att.versions.length} versions available - select one in the preview to switch`
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        thumbButton
                      )}
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* Right: Title, Copy and Comments */}
        <div className="flex flex-col gap-4 h-full min-h-0" data-section="copy-comments-container">
          <div className="shrink-0" data-section="title-section">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">{tr("Título", "Title")}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {post.title?.trim() ? (
                  <p className="text-base font-semibold leading-snug">{post.title}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{tr("Sem título", "Untitled")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 min-h-0 flex flex-col" data-section="copy-section">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium">{tr("Copy", "Caption")}</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  disabled={copying}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copying ? tr("Copiado!", "Copied!") : tr("Copiar", "Copy")}
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{post.copyText}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 min-h-[220px] overflow-hidden" data-section="comments-section">
            <CommentThread
              comments={post.comments}
              onAddComment={(text) => onCommentAdd(post.id, text)}
              canComment={canComment}
            />
          </div>

          <ApprovalActivity events={post.activity ?? []} legacyApproval={post.legacyApproval} />
        </div>
      </div>
    </div>
  );
}
