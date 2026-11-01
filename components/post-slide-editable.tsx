"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Copy, Clock, Edit2, Trash2, Save, X, Plus, ImageIcon, Upload, Info, UserRound, ArrowRightLeft,
} from "lucide-react";
import { MediaThumb } from "@/components/media-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommentThread } from "./comment-thread";
import { ApprovalActivity } from "./approval-activity";
import { VersionSelector } from "./version-selector";
import { MediaSourceInput } from "./media-source-input";
import { AttachmentSequenceViewer } from "./attachment-sequence-viewer";
import { CarouselSlidesInput, type SlideDraft } from "./carousel-slides-input";
import { CarouselSlidesManager } from "./carousel-slides-manager";
import {
  PostMaterialForm,
  createEmptyMaterialDraft,
  isMaterialDraftValid,
  buildAttachmentRequestBody,
  getAttachmentAspectRatio,
} from "./post-material-form";
import { resolveVersionSlides } from "@/lib/attachment-slides";
import {
  getAttachmentVersionNumbers,
  isViewingHistoricalAttachment,
  isViewingLatestApprovalPackage,
} from "@/lib/viewed-approval-package";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import type { AttachmentVersion } from "@/lib/types";
import {
  type Post,
  type PostAttachment,
  getAttachmentTypeLabel,
} from "./post-slide";
import { getProductionStageStyle } from "@/lib/production-stages";
import { getLocalizedProductionStageLabel } from "@/components/post-production-fields";

interface PostSlideEditableProps {
  post: Post;
  clientName: string;
  isAdmin: boolean;
  onCommentAdd: (postId: string, text: string) => void;
  onPostUpdate: (postId: string, data: Partial<Post>) => void;
  onPostDelete?: (postId: string) => void;
  onAddPostToDay?: (date: Date) => void;
  onAttachmentAdd?: (
    postId: string,
    type: string,
    label: string | null,
    url: string,
    slides?: SlideDraft[]
  ) => void;
  onAttachmentVersionAdd?: (
    attachmentId: string,
    url: string,
    slides?: SlideDraft[]
  ) => void;
  onAttachmentVersionUpdate?: (attachmentId: string, version: AttachmentVersion) => void;
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
  onDelegate?: (post: Post) => void;
  dayPostIndex?: number;
  dayPostCount?: number;
  onViewedPackageChange?: (isLatest: boolean) => void;
  onRegisterShowCurrentVersion?: (showCurrent: () => void) => void;
}

export function PostSlideEditable({
  post,
  clientName,
  isAdmin,
  onCommentAdd,
  onPostUpdate,
  onPostDelete,
  onAddPostToDay,
  onAttachmentAdd,
  onAttachmentVersionAdd,
  onAttachmentVersionUpdate,
  onPinCreate,
  onPinResolve,
  onPinDelete,
  onDelegate,
  dayPostIndex,
  dayPostCount,
  onViewedPackageChange,
  onRegisterShowCurrentVersion,
}: PostSlideEditableProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [copying, setCopying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState(0);
  const [activeVersionIndex, setActiveVersionIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    setActiveAttachmentIndex(0);
    setActiveVersionIndex({});
  }, [post.id]);
  const [showAddAttachment, setShowAddAttachment] = useState(false);
  const [materialDraft, setMaterialDraft] = useState(createEmptyMaterialDraft);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [newVersionUrl, setNewVersionUrl] = useState("");
  const [newVersionUrls, setNewVersionUrls] = useState<SlideDraft[]>([
    { url: "", mediaType: "image" },
    { url: "", mediaType: "image" },
  ]);

  const [editData, setEditData] = useState({
    scheduledAt: post.scheduledAt,
    channel: post.channel,
    title: post.title ?? "",
    copyText: post.copyText,
  });

  useEffect(() => {
    setEditData({
      scheduledAt: post.scheduledAt,
      channel: post.channel,
      title: post.title ?? "",
      copyText: post.copyText,
    });
  }, [post.id, post.scheduledAt, post.channel, post.title, post.copyText]);

  const attachments = post.attachments || [];
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(post.copyText);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleSave = async () => {
    try {
      await onPostUpdate(post.id, editData);
      setEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const handleCancel = () => {
    setEditData({
      scheduledAt: post.scheduledAt,
      channel: post.channel,
      title: post.title ?? "",
      copyText: post.copyText,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(tr("Tem certeza que deseja deletar este post?", "Are you sure you want to delete this post?"))) {
      onPostDelete?.(post.id);
    }
  };

  const handleAddAttachment = () => {
    if (!isMaterialDraftValid(materialDraft)) return;
    const payload = buildAttachmentRequestBody(materialDraft);
    if (materialDraft.type === "carousel" && payload.slides) {
      onAttachmentAdd?.(post.id, payload.type, payload.label, payload.url, payload.slides);
    } else {
      onAttachmentAdd?.(post.id, payload.type, payload.label, payload.url);
    }
    setMaterialDraft(createEmptyMaterialDraft());
    setShowAddAttachment(false);
  };

  const handleAddVersion = () => {
    if (!currentAttachment) return;
    if (currentAttachment.type === "carousel") {
      const slides = newVersionUrls.filter((item) => item.url.trim().length > 0);
      if (slides.length < 2) return;
      onAttachmentVersionAdd?.(currentAttachment.id, slides[0].url, slides);
      setNewVersionUrls([
        { url: "", mediaType: "image" },
        { url: "", mediaType: "image" },
      ]);
    } else {
      if (!newVersionUrl) return;
      onAttachmentVersionAdd?.(currentAttachment.id, newVersionUrl);
      setNewVersionUrl("");
    }
    setShowAddVersion(false);
  };

  const getAttachmentLabel = (att: PostAttachment) => {
    return att.label || getAttachmentTypeLabel(att.type, locale);
  };

  return (
    <div className="min-h-screen lg:h-screen w-screen flex flex-col pt-16" data-component="post-slide-editable" id={`post-${post.id}`}>
      {/* Info Bar */}
      <div className="relative flex flex-col gap-2 py-3 border-b bg-muted/30 px-6" data-section="info-bar">
        <div className="flex items-center justify-center">
        <div className="flex items-center gap-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="text-center" data-section="date-info">
            {editing ? (
              <div className="flex flex-col gap-1">
                <input
                  type="datetime-local"
                  value={format(new Date(editData.scheduledAt), "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setEditData({ ...editData, scheduledAt: e.target.value })}
                  className="text-sm font-semibold px-2 py-1 border rounded bg-background"
                />
                <input
                  type="text"
                  value={editData.channel}
                  onChange={(e) => setEditData({ ...editData, channel: e.target.value })}
                  placeholder={tr("Canal", "Channel")}
                  className="text-xs px-2 py-1 border rounded bg-background"
                />
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {!editing && dayPostCount && dayPostCount > 1 && (
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

          {/* Admin Actions */}
          {isAdmin && (
            <div className="flex gap-2 ml-4 pl-4 border-l" data-section="admin-actions">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-1" /> {tr("Cancelar", "Cancel")}
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" /> {tr("Salvar", "Save")}
                  </Button>
                </>
              ) : (
                <>
                  {onAddPostToDay && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddPostToDay(new Date(post.scheduledAt))}
                    >
                      <Plus className="h-4 w-4 mr-1" /> {tr("Novo post", "New post")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-1" /> {tr("Editar", "Edit")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-1" /> {tr("Deletar", "Delete")}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        </div>

        {isAdmin && !editing && (
          <div className="flex items-center justify-center gap-2 flex-wrap" data-section="production-info">
            {post.productionStage && (
              <Badge variant="secondary" className={getProductionStageStyle(post.productionStage)}>
                {getLocalizedProductionStageLabel(post.productionStage, locale)}
              </Badge>
            )}
            {post.assignee ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1 bg-background/80 border rounded-full px-2.5 py-1">
                <UserRound className="h-3 w-3" />
                {post.assignee.name || post.assignee.email}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-background/80 border rounded-full px-2.5 py-1">
                {tr("Sem responsável", "Unassigned")}
              </span>
            )}
            {onDelegate && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onDelegate(post)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                {tr("Delegar", "Delegate")}
              </Button>
            )}
            {post.handoffNote && (
              <span className="text-xs text-muted-foreground max-w-md truncate" title={post.handoffNote}>
                · {post.handoffNote}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 px-4 lg:px-6 py-4 lg:py-6 lg:pb-8 overflow-y-auto lg:overflow-hidden" data-section="main-content">
        {/* Left: Image Preview + Attachment Thumbnails */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden" data-section="image-area" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {/* Main preview */}
          <div className="relative flex-1 min-h-0 overflow-hidden bg-muted/20 rounded-lg border">
            {/* Version selector */}
            {currentAttachment && currentAttachment.versions.length > 0 && (
              <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2">
                {viewingHistoricalCreative && versionNumbers ? (
                  <div className="rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm border max-w-[55%]">
                    {tr(
                      `Vendo a versão ${versionNumbers.viewing} · A vigente é a ${versionNumbers.current}`,
                      `Viewing version ${versionNumbers.viewing} · Current version is ${versionNumbers.current}`
                    )}
                  </div>
                ) : !viewingLatestPackage ? (
                  <div className="rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm border max-w-[55%]">
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
                  onAddVersion={
                    isAdmin && !showAddVersion
                      ? () => setShowAddVersion(true)
                      : undefined
                  }
                />
              </div>
            )}

            {/* Add version overlay */}
            {showAddVersion && currentAttachment && (
              <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm rounded-lg flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                  <div>
                    <h3 className="font-semibold text-sm">{tr("Nova versão", "New version")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {getAttachmentLabel(currentAttachment)} - {tr("versão", "version")} {currentAttachment.versions.length + 1}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setShowAddVersion(false);
                      setNewVersionUrl("");
                      setNewVersionUrls([
                        { url: "", mediaType: "image" },
                        { url: "", mediaType: "image" },
                      ]);
                    }}
                    aria-label={tr("Cancelar", "Cancel")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
                  <div className="w-full max-w-sm mx-auto space-y-4 pb-2">
                    {currentAttachment.type === "carousel" ? (
                      <CarouselSlidesInput
                        slides={newVersionUrls}
                        onChange={setNewVersionUrls}
                        aspectRatio={getAttachmentAspectRatio(currentAttachment.type)}
                        dense
                      />
                    ) : (
                      <MediaSourceInput
                        value={newVersionUrl}
                        onChange={setNewVersionUrl}
                        aspectRatio={getAttachmentAspectRatio(currentAttachment.type)}
                        compact
                      />
                    )}
                  </div>
                </div>
                <div className="shrink-0 border-t px-4 py-3 bg-background/95">
                  <div className="flex gap-2 max-w-sm mx-auto w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowAddVersion(false);
                          setNewVersionUrl("");
                          setNewVersionUrls([
                            { url: "", mediaType: "image" },
                            { url: "", mediaType: "image" },
                          ]);
                        }}
                      >
                        {tr("Cancelar", "Cancel")}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleAddVersion}
                        disabled={
                          currentAttachment.type === "carousel"
                            ? newVersionUrls.filter((item) => item.url.trim()).length < 2
                            : !newVersionUrl
                        }
                      >
                        <Upload className="h-4 w-4 mr-1" /> {tr("Enviar", "Upload")} v{currentAttachment.versions.length + 1}
                      </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add attachment overlay */}
            {showAddAttachment && (
              <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm rounded-lg flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                  <div>
                    <h3 className="font-semibold text-sm">{tr("Novo material", "New creative")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {tr("Adicione um anexo ao post", "Add an attachment to the post")}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setShowAddAttachment(false);
                      setMaterialDraft(createEmptyMaterialDraft());
                    }}
                    aria-label={tr("Cancelar", "Cancel")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
                  <div className="w-full max-w-sm mx-auto pb-2">
                    <PostMaterialForm
                      draft={materialDraft}
                      onChange={setMaterialDraft}
                      dense
                    />
                  </div>
                </div>
                <div className="shrink-0 border-t px-4 py-3 bg-background/95">
                  <div className="flex gap-2 max-w-sm mx-auto w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowAddAttachment(false);
                          setMaterialDraft(createEmptyMaterialDraft());
                        }}
                      >
                        {tr("Cancelar", "Cancel")}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleAddAttachment}
                        disabled={!isMaterialDraftValid(materialDraft)}
                      >
                        <Plus className="h-4 w-4 mr-1" /> {tr("Adicionar", "Add")}
                      </Button>
                  </div>
                </div>
              </div>
            )}

            {currentVersion && currentImageUrl && !showAddVersion && !showAddAttachment ? (
              <AttachmentSequenceViewer
                attachmentType={currentAttachment?.type ?? "other"}
                version={currentVersion}
                canAnnotate={!!onPinCreate && !editing}
                author="agency"
                onPinCreate={onPinCreate}
                onPinResolve={onPinResolve}
                onPinDelete={onPinDelete}
              />
            ) : !showAddVersion && !showAddAttachment ? (
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ImageIcon className="h-12 w-12" />
                <p className="text-sm">{tr("Nenhum material anexado", "No creatives attached")}</p>
              </div>
            ) : null}
          </div>

          {/* Attachment thumbnails strip + Add button */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2 overflow-x-auto pb-1" data-section="attachment-strip">
              {attachments.map((att, i) => {
                const lastVersion = att.versions[att.versions.length - 1];
                const hasMultipleVersions = att.versions.length > 1;

                const thumbButton = (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAttachmentIndex(i);
                      setShowAddVersion(false);
                      setShowAddAttachment(false);
                    }}
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

            {/* Add attachment button */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowAddAttachment(true);
                  setShowAddVersion(false);
                }}
                className="flex-shrink-0 flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all w-[68px] h-[82px]"
              >
                <Plus className="h-6 w-6 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">{tr("Adicionar", "Add")}</span>
              </button>
            )}
            </div>
          </TooltipProvider>

          {isAdmin &&
            currentAttachment &&
            currentVersion &&
            onAttachmentVersionUpdate &&
            (currentAttachment.type === "carousel" || currentSlides.length > 1) && (
              <CarouselSlidesManager
                versionId={currentVersion.id}
                attachmentType={currentAttachment.type}
                slides={currentSlides}
                onVersionUpdated={(version) =>
                  onAttachmentVersionUpdate(currentAttachment.id, version)
                }
              />
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
                {editing ? (
                  <Input
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    placeholder={tr("Tema do post (ex.: Lançamento coleção verão)", "Post topic (e.g.: Summer collection launch)")}
                    className="font-semibold"
                  />
                ) : post.title?.trim() ? (
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
                {!editing && (
                  <Button size="sm" variant="outline" onClick={handleCopy} disabled={copying}>
                    <Copy className="h-4 w-4 mr-2" />
                    {copying ? tr("Copiado!", "Copied!") : tr("Copiar", "Copy")}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {editing ? (
                  <textarea
                    value={editData.copyText}
                    onChange={(e) => setEditData({ ...editData, copyText: e.target.value })}
                    className="w-full h-full min-h-[120px] px-3 py-2 text-sm border rounded-md bg-background resize-none"
                    placeholder={tr("Digite o texto do post...", "Type the post text...")}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{post.copyText}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 min-h-[220px] overflow-hidden" data-section="comments-section">
            <CommentThread
              comments={post.comments}
              onAddComment={(text) => onCommentAdd(post.id, text)}
            />
          </div>

          <ApprovalActivity events={post.activity ?? []} legacyApproval={post.legacyApproval} />
        </div>
      </div>
    </div>
  );
}
