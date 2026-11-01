"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { addDays, subDays, startOfDay, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PostSlide, type Post, type PostStatus } from "@/components/post-slide";
import { PostSlideEditable } from "@/components/post-slide-editable";
import { CalendarModal } from "@/components/calendar-modal";
import { CalendarView } from "@/components/calendar-view";
import { EmptyDaySlide } from "@/components/empty-day-slide";
import { Header } from "@/components/header";
import { PostHandoffDialog } from "@/components/post-handoff-dialog";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

export default function CalendarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, en: string) => localizedText(locale, pt, en),
    [locale]
  );

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewDate, setViewDate] = useState<Date | null>(null);
  const [dayPostIndex, setDayPostIndex] = useState(0);
  const [clientName, setClientName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState({
    canComment: true,
    canPin: true,
    canApprove: true,
  });
  const [teamMembers, setTeamMembers] = useState<
    Array<{ user: { id: string; name: string | null; email: string } }>
  >([]);
  const [handoffPost, setHandoffPost] = useState<Post | null>(null);
  const [viewingLatestPackage, setViewingLatestPackage] = useState(true);
  const showCurrentVersionRef = useRef<() => void>(() => {});
  const registerShowCurrentVersion = useCallback((showCurrent: () => void) => {
    showCurrentVersionRef.current = showCurrent;
  }, []);

  const fetchPosts = useCallback(async () => {
    const url = token
      ? `/api/calendar/${params.clientSlug}/${params.versionId}/posts?t=${token}`
      : `/api/calendar/${params.clientSlug}/${params.versionId}/posts`;

    const response = await fetch(url);

    if (!response.ok) {
      const data = await response.json();
      const error = new Error(data.error || tr("Erro ao carregar posts", "Failed to load posts")) as Error & {
        code?: string;
      };
      error.code = data.code;
      throw error;
    }

    const data = await response.json();
    const loadedPosts: Post[] = data.posts ?? [];

    setIsAdmin(Boolean(data.isAdmin));

    if (data.access?.reviewer) {
      setReviewerName(data.access.reviewer.name);
    }
    if (data.access?.permissions) {
      setPermissions(data.access.permissions);
    }

    if (data.isAdmin) {
      try {
        const teamRes = await fetch("/api/team");
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeamMembers(teamData.members ?? []);
        }
      } catch {
        // team list is optional for delegation
      }
    } else {
      setTeamMembers([]);
    }

    setClientName(
      String(params.clientSlug)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );

    if (loadedPosts.length > 0) {
      setCurrentMonth(new Date(loadedPosts[0].scheduledAt));
      setViewDate((prev) => prev ?? startOfDay(new Date(loadedPosts[0].scheduledAt)));
      setDayPostIndex(0);
    }

    setPosts(loadedPosts);
  }, [token, params.clientSlug, params.versionId, tr]);

  useEffect(() => {
    async function init() {
      try {
        await fetchPosts();
      } catch (err) {
        const failed = err as Error & { code?: string };
        setError(failed instanceof Error ? failed.message : tr("Erro desconhecido", "Unknown error"));
        setErrorCode(failed.code ?? null);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [fetchPosts, tr]);

  const handleStatusChange = async (postId: string, status: PostStatus) => {
    try {
      const response = await fetch(`/api/posts/${postId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, token }),
      });

      if (!response.ok) {
        throw new Error(tr("Erro ao atualizar status", "Failed to update status"));
      }

      // Update local state
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId ? { ...post, status } : post
          )
        );
        await fetchPosts();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleCommentAdd = async (postId: string, text: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, token }),
      });

      if (!response.ok) {
        throw new Error(tr("Erro ao adicionar comentário", "Failed to add comment"));
      }

      const data = await response.json();

      console.log("Comment created:", data.comment);

      // Update local state
      setPosts((prev) => {
        const updated = prev.map((post) =>
          post.id === postId
            ? { ...post, comments: [...post.comments, data.comment] }
            : post
        );
        console.log("Updated posts:", updated.find(p => p.id === postId)?.comments);
        return updated;
      });
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const insertPostAndFocus = useCallback((post: Post) => {
    const postDay = startOfDay(new Date(post.scheduledAt));
    setPosts((prev) => {
      const updated = [...prev, post].sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      const postsOnDay = updated.filter((p) =>
        isSameDay(new Date(p.scheduledAt), postDay)
      );
      const indexInDay = postsOnDay.findIndex((p) => p.id === post.id);
      setViewDate(postDay);
      setCurrentMonth(postDay);
      setDayPostIndex(indexInDay >= 0 ? indexInDay : 0);
      return updated;
    });
  }, []);

  const createPostOnDate = useCallback(
    async (date: Date) => {
      const scheduledAt = startOfDay(date);
      const response = await fetch(
        `/api/calendar/${params.clientSlug}/${params.versionId}/posts/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: scheduledAt.toISOString(),
            channel: "Instagram",
            copyText: "",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(tr("Erro ao criar post", "Failed to create post"));
      }

      const data = await response.json();
      if (data.post) {
        insertPostAndFocus(data.post);
      }
    },
    [params.clientSlug, params.versionId, insertPostAndFocus, tr]
  );

  const selectDay = useCallback((date: Date) => {
    const day = startOfDay(date);
    setViewDate(day);
    setCurrentMonth(day);
    setDayPostIndex(0);
  }, []);

  const handleHandoffSuccess = () => {
    void fetchPosts();
    setHandoffPost(null);
  };

  const handlePostUpdate = async (postId: string, data: Partial<Post>) => {
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(tr("Erro ao atualizar post", "Failed to update post"));
      }

      const updated = await response.json();

      // Update local state
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, ...updated.post } : post
        )
      );
    } catch (err) {
      console.error("Error updating post:", err);
      alert(tr("Erro ao atualizar post", "Failed to update post"));
    }
  };

  const handlePostDelete = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(tr("Erro ao deletar post", "Failed to delete post"));
      }

      setPosts((prev) => {
        const updated = prev.filter((post) => post.id !== postId);
        if (updated.length === 0) {
          setViewDate(null);
          setDayPostIndex(0);
          return updated;
        }

        if (viewDate) {
          const remainingOnDay = updated.filter((p) =>
            isSameDay(new Date(p.scheduledAt), viewDate)
          );
          if (remainingOnDay.length === 0) {
            setDayPostIndex(0);
          } else {
            setDayPostIndex((idx) =>
              Math.min(idx, remainingOnDay.length - 1)
            );
          }
        }
        return updated;
      });
    } catch (err) {
      console.error("Error deleting post:", err);
      alert(tr("Erro ao deletar post", "Failed to delete post"));
    }
  };

  const handleAddPostToDay = async (date: Date) => {
    try {
      await createPostOnDate(date);
    } catch (err) {
      console.error("Error creating post:", err);
      alert(tr("Erro ao criar post", "Failed to create post"));
    }
  };

  const handlePinCreate = async (
    versionId: string,
    xPercent: number,
    yPercent: number,
    text: string,
    author: "agency" | "client",
    slideId?: string | null
  ) => {
    try {
      const response = await fetch(`/api/attachment-versions/${versionId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ xPercent, yPercent, text, author, slideId, token }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
          await fetchPosts();
          alert(
            tr(
              "Os dados do post estavam desatualizados. Recarregamos - tente anotar novamente.",
              "The post data was out of date. We reloaded it - please try annotating again."
            )
          );
          return;
        }
        throw new Error(
          typeof data.error === "string" ? data.error : tr("Erro ao criar anotação", "Failed to create annotation")
        );
      }

      const data = await response.json();
      const createdPin = {
        id: data.pin.id,
        xPercent: data.pin.xPercent,
        yPercent: data.pin.yPercent,
        text: data.pin.text,
        author: data.pin.author as "agency" | "client",
        authorName: data.pin.authorName ?? null,
        resolved: Boolean(data.pin.resolved),
        createdAt: data.pin.createdAt,
        attachmentSlideId: data.pin.attachmentSlideId ?? null,
      };

      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          attachments: (post.attachments || []).map((att) => ({
            ...att,
            versions: att.versions.map((v) => {
              if (v.id !== versionId) return v;
              if (slideId && v.slides?.length) {
                return {
                  ...v,
                  slides: v.slides.map((slide) =>
                    slide.id === slideId
                      ? {
                          ...slide,
                          pins: [...(slide.pins ?? []).filter((p) => p.id !== createdPin.id), createdPin],
                        }
                      : slide
                  ),
                };
              }
              return {
                ...v,
                pins: [...(v.pins ?? []).filter((p) => p.id !== createdPin.id), createdPin],
              };
            }),
          })),
        }))
      );
    } catch (err) {
      console.error("Error creating pin:", err);
      alert(err instanceof Error ? err.message : tr("Erro ao criar anotação", "Failed to create annotation"));
    }
  };

  const handlePinResolve = async (pinId: string, resolved: boolean) => {
    try {
      const response = await fetch(`/api/attachment-versions/any/pins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pinId, resolved, token }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : tr("Erro ao atualizar anotação", "Failed to update annotation")
        );
      }

      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          attachments: (post.attachments || []).map((att) => ({
            ...att,
            versions: att.versions.map((v) => ({
              ...v,
              pins: (v.pins ?? []).map((p) => (p.id === pinId ? { ...p, resolved } : p)),
              slides: (v.slides ?? []).map((slide) => ({
                ...slide,
                pins: (slide.pins ?? []).map((p) => (p.id === pinId ? { ...p, resolved } : p)),
              })),
            })),
          })),
        }))
      );
    } catch (err) {
      console.error("Error resolving pin:", err);
      alert(err instanceof Error ? err.message : tr("Erro ao atualizar anotação", "Failed to update annotation"));
    }
  };

  const handlePinDelete = async (pinId: string) => {
    try {
      const response = await fetch(`/api/attachment-versions/any/pins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pinId, token }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : tr("Erro ao excluir anotação", "Failed to delete annotation")
        );
      }

      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          attachments: (post.attachments || []).map((att) => ({
            ...att,
            versions: att.versions.map((v) => ({
              ...v,
              pins: (v.pins ?? []).filter((p) => p.id !== pinId),
              slides: (v.slides ?? []).map((slide) => ({
                ...slide,
                pins: (slide.pins ?? []).filter((p) => p.id !== pinId),
              })),
            })),
          })),
        }))
      );
    } catch (err) {
      console.error("Error deleting pin:", err);
      alert(err instanceof Error ? err.message : tr("Erro ao excluir anotação", "Failed to delete annotation"));
    }
  };

  const handleAttachmentAdd = async (
    postId: string,
    type: string,
    label: string | null,
    url: string,
    slides?: Array<{ url: string; mediaType: "image" | "video" }>
  ) => {
    try {
      const response = await fetch(`/api/posts/${postId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label, url, slides }),
      });

      if (!response.ok) throw new Error(tr("Erro ao adicionar material", "Failed to add creative"));

      const data = await response.json();
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, attachments: [...(post.attachments || []), data.attachment] }
            : post
        )
      );
    } catch (err) {
      console.error("Error adding attachment:", err);
      alert(tr("Erro ao adicionar material", "Failed to add creative"));
    }
  };

  const handleAttachmentVersionAdd = async (
    attachmentId: string,
    url: string,
    slides?: Array<{ url: string; mediaType: "image" | "video" }>
  ) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, slides }),
      });

      if (!response.ok) throw new Error(tr("Erro ao adicionar versão", "Failed to add version"));

      const data = await response.json();
      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          attachments: (post.attachments || []).map((att) =>
            att.id === attachmentId
              ? { ...att, versions: [...att.versions, data.version] }
              : att
          ),
        }))
      );
    } catch (err) {
      console.error("Error adding version:", err);
      alert(tr("Erro ao adicionar versão", "Failed to add version"));
    }
  };

  const handleAttachmentVersionUpdate = (
    attachmentId: string,
    version: (typeof posts)[number]["attachments"][number]["versions"][number]
  ) => {
    setPosts((prev) =>
      prev.map((post) => ({
        ...post,
        attachments: (post.attachments || []).map((att) =>
          att.id === attachmentId
            ? {
                ...att,
                versions: att.versions.map((v) => (v.id === version.id ? version : v)),
              }
            : att
        ),
      }))
    );
  };

  const openCalendarForDate = useCallback((date: Date) => {
    setCurrentMonth(date);
    setCalendarOpen(true);
  }, []);

  const navigateDays = useCallback(
    (direction: "prev" | "next") => {
      if (!viewDate) return;

      const postsOnDay = posts
        .filter((p) => isSameDay(new Date(p.scheduledAt), viewDate))
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );

      if (direction === "next" && dayPostIndex < postsOnDay.length - 1) {
        setDayPostIndex(dayPostIndex + 1);
        return;
      }

      if (direction === "prev" && dayPostIndex > 0) {
        setDayPostIndex(dayPostIndex - 1);
        return;
      }

      const nextDate =
        direction === "next" ? addDays(viewDate, 1) : subDays(viewDate, 1);
      const postsOnNext = posts
        .filter((p) => isSameDay(new Date(p.scheduledAt), nextDate))
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );

      setViewDate(nextDate);
      setCurrentMonth(nextDate);
      setDayPostIndex(
        direction === "next"
          ? 0
          : Math.max(0, postsOnNext.length - 1)
      );
    },
    [viewDate, posts, dayPostIndex]
  );

  useEffect(() => {
    if (!viewDate) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateDays("prev");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateDays("next");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewDate, navigateDays]);

  const postsOnViewDate = useMemo(() => {
    if (!viewDate) return [];
    return posts
      .filter((p) => isSameDay(new Date(p.scheduledAt), viewDate))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
  }, [posts, viewDate]);

  const currentPost =
    postsOnViewDate[
      Math.min(dayPostIndex, Math.max(postsOnViewDate.length - 1, 0))
    ] ?? null;
  const inDayView = viewDate !== null;

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-4xl p-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    const unavailable = errorCode === "WORKSPACE_UNAVAILABLE";
    return (
      <div className="h-screen w-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">
            {unavailable
              ? tr(
                  "Este espaço está temporariamente indisponível.",
                  "This workspace is temporarily unavailable."
                )
              : tr("Erro", "Error")}
          </h1>
          <p className="text-muted-foreground">
            {unavailable
              ? tr(
                  "Entre em contato com a equipe responsável pelo conteúdo.",
                  "Please contact the team responsible for this content."
                )
              : error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        clientName={clientName}
        currentStatus={currentPost?.status || "pending"}
        onStatusChange={(status) =>
          currentPost && handleStatusChange(currentPost.id, status)
        }
        onCalendarClick={() =>
          openCalendarForDate(viewDate ?? currentMonth)
        }
        canApprove={permissions.canApprove}
        allowPendingReset={isAdmin && permissions.canApprove}
        showReadOnlyStatus={isAdmin}
        viewingLatestPackage={viewingLatestPackage}
        onShowCurrentVersion={() => showCurrentVersionRef.current()}
        showStatus={Boolean(currentPost)}
        reviewerName={!isAdmin ? reviewerName : null}
      />

      {inDayView && viewDate ? (
        <>
          <button
            type="button"
            className="fixed z-30 flex items-center justify-center w-10 h-10 rounded-full bg-background border hover:bg-accent transition-colors cursor-pointer"
            style={{ left: "24px", top: "75px" }}
            data-action="prev-slide"
            id="nav-arrow-prev"
            title={tr("Dia anterior", "Previous day")}
            onClick={() => navigateDays("prev")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            className="fixed z-30 flex items-center justify-center w-10 h-10 rounded-full bg-background border hover:bg-accent transition-colors cursor-pointer"
            style={{ right: "24px", top: "75px" }}
            data-action="next-slide"
            id="nav-arrow-next"
            title={tr("Próximo dia", "Next day")}
            onClick={() => navigateDays("next")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {currentPost ? (
            isAdmin ? (
              <PostSlideEditable
                key={currentPost.id}
                post={currentPost}
                clientName={clientName}
                isAdmin={isAdmin}
                onCommentAdd={handleCommentAdd}
                onPostUpdate={handlePostUpdate}
                onPostDelete={handlePostDelete}
                onAddPostToDay={handleAddPostToDay}
                onAttachmentAdd={handleAttachmentAdd}
                onAttachmentVersionAdd={handleAttachmentVersionAdd}
                onAttachmentVersionUpdate={handleAttachmentVersionUpdate}
                onPinCreate={handlePinCreate}
                onPinResolve={handlePinResolve}
                onPinDelete={handlePinDelete}
                onDelegate={setHandoffPost}
                onViewedPackageChange={setViewingLatestPackage}
                onRegisterShowCurrentVersion={registerShowCurrentVersion}
                dayPostIndex={dayPostIndex + 1}
                dayPostCount={postsOnViewDate.length}
              />
            ) : (
              <PostSlide
                key={currentPost.id}
                post={currentPost}
                clientName={clientName}
                onCommentAdd={handleCommentAdd}
                onPinCreate={permissions.canPin ? handlePinCreate : undefined}
                onPinResolve={permissions.canPin ? handlePinResolve : undefined}
                onPinDelete={permissions.canPin ? handlePinDelete : undefined}
                canComment={permissions.canComment}
                canAnnotate={permissions.canPin}
                onViewedPackageChange={setViewingLatestPackage}
                onRegisterShowCurrentVersion={registerShowCurrentVersion}
                dayPostIndex={dayPostIndex + 1}
                dayPostCount={postsOnViewDate.length}
              />
            )
          ) : (
            <EmptyDaySlide
              date={viewDate}
              isAdmin={isAdmin}
              onAddPost={
                isAdmin
                  ? () => {
                      void handleAddPostToDay(viewDate);
                    }
                  : undefined
              }
            />
          )}
        </>
      ) : (
        <div className="min-h-screen w-full flex items-start justify-center px-4 pt-24 pb-10">
          <CalendarView
            className="w-full max-w-3xl"
            posts={posts}
            onSelectDay={selectDay}
            currentMonth={currentMonth}
            isAdmin={isAdmin}
            title={
              isAdmin
                ? tr("Escolha uma data", "Pick a date")
                : tr("Nenhuma publicação ainda", "No posts yet")
            }
            subtitle={
              isAdmin
                ? tr(
                    "Clique em um dia para abrir o calendário. Você cria a publicação quando quiser com “+ Novo post”.",
                    "Click a day to open the calendar. Create a post whenever you like with “+ New post”."
                  )
                : tr(
                    "Este calendário ainda não possui publicações para revisar.",
                    "This calendar doesn't have any posts to review yet."
                  )
            }
          />
        </div>
      )}

      <CalendarModal
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        posts={posts}
        onSelectDay={selectDay}
        onCreateOnDay={
          isAdmin
            ? (date) => {
                void handleAddPostToDay(date);
              }
            : undefined
        }
        currentMonth={currentMonth}
        isAdmin={isAdmin}
      />

      {handoffPost && (
        <PostHandoffDialog
          open={Boolean(handoffPost)}
          onOpenChange={(open) => !open && setHandoffPost(null)}
          postId={handoffPost.id}
          initialStage={handoffPost.productionStage || "draft_copy"}
          initialAssigneeId={handoffPost.assigneeId ?? null}
          members={teamMembers}
          onSuccess={handleHandoffSuccess}
        />
      )}
    </>
  );
}
