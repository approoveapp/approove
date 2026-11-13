"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Pencil,
  Trash2,
  Loader2,
  Link2,
  Calendar,
  FileText,
  ImageIcon,
  MessageSquare,
  Users,
  UserRound,
  Sparkles,
} from "lucide-react";
import { ClientReviewersTab } from "@/components/client-reviewers-tab";
import { PostHandoffDialog } from "@/components/post-handoff-dialog";
import {
  PostMaterialForm,
  createEmptyMaterialDraft,
  isMaterialDraftValid,
  buildAttachmentRequestBody,
  getMaterialDraftLabel,
  type PostMaterialDraft,
} from "@/components/post-material-form";
import { getAttachmentTypeLabel } from "@/components/post-slide";
import { getProductionStageStyle } from "@/lib/production-stages";
import {
  PostProductionFields,
  getLocalizedProductionStageLabel,
} from "@/components/post-production-fields";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { ImportFlow } from "@/components/import/import-flow";
import { PostCalendar } from "@/components/post-calendar";
import { PRODUCTION_STAGES } from "@/lib/production-stages";
import { MediaThumb } from "@/components/media-thumb";

interface AttachmentVersionData {
  id: string;
  url: string;
  version: number;
}

interface AttachmentData {
  id: string;
  type: string;
  label: string | null;
  order: number;
  versions: AttachmentVersionData[];
}

interface PostData {
  id: string;
  scheduledAt: string;
  channel: string;
  title?: string;
  copyText: string;
  status: string;
  productionStage: string;
  assigneeId: string | null;
  handoffNote?: string | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  comments: Array<{ id: string; author: string; text: string; createdAt: string }>;
  attachments?: AttachmentData[];
}

interface TeamMember {
  user: { id: string; name: string | null; email: string };
}

interface VersionData {
  id: string;
  version: string;
  posts: PostData[];
  tokens: Array<{ token: string }>;
}

interface ClientDetail {
  id: string;
  slug: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  versions: VersionData[];
}

const CHANNELS = [
  { value: "Instagram", color: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400" },
  { value: "Facebook", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  { value: "LinkedIn", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400" },
  { value: "TikTok", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "Twitter/X", color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" },
  { value: "YouTube", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
];

const STATUS_MAP: Record<string, { label: string; labelEn: string; class: string }> = {
  pending: { label: "Pendente", labelEn: "Pending", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  approved: { label: "Aprovado", labelEn: "Approved", class: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
  adjustments: { label: "Ajustes", labelEn: "Changes", class: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
};

const defaultPostForm = {
  scheduledAt: "",
  channel: "Instagram",
  title: "",
  copyText: "",
};

const defaultProductionForm = {
  productionStage: "draft_copy",
  assigneeId: "",
  handoffNote: "",
};

export default function ClientDetailPage() {
  const router = useRouter();
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const [tab, setTab] = useState(() => searchParams.get("tab") ?? "calendar");

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Post dialog
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postForm, setPostForm] = useState(defaultPostForm);
  const [postSaving, setPostSaving] = useState(false);
  const [materialDraft, setMaterialDraft] = useState<PostMaterialDraft>(createEmptyMaterialDraft);
  const [pendingMaterials, setPendingMaterials] = useState<PostMaterialDraft[]>([]);
  const [productionForm, setProductionForm] = useState(defaultProductionForm);
  const [showMaterialsSection, setShowMaterialsSection] = useState(false);

  // Info edit
  const [infoForm, setInfoForm] = useState({
    name: "", cnpj: "", address: "", website: "", instagram: "", facebook: "", linkedin: "",
  });
  const [infoSaving, setInfoSaving] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [handoffPost, setHandoffPost] = useState<PostData | null>(null);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importNotice, setImportNotice] = useState<number | null>(null);
  const [calendarFocus, setCalendarFocus] = useState<string | null>(null);
  const [planDragOver, setPlanDragOver] = useState(false);
  const planInputRef = useRef<HTMLInputElement>(null);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (!res.ok) return;
      const data = await res.json();
      setTeamMembers(data.members ?? []);
    } catch {
      // team list is optional for handoff
    }
  }, []);

  const fetchClient = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/clients/${slug}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(
          typeof data.error === "string"
            ? data.error
            : localizedText(
                locale,
                "Cliente não encontrado ou sem permissão de acesso",
                "Client not found or you don't have access"
              )
        );
        return;
      }
      setClient(data.client);
      setCanManage(data.canManage === true);
      setInfoForm({
        name: data.client.name || "",
        cnpj: data.client.cnpj || "",
        address: data.client.address || "",
        website: data.client.website || "",
        instagram: data.client.instagram || "",
        facebook: data.client.facebook || "",
        linkedin: data.client.linkedin || "",
      });
    } catch {
      setLoadError(
        localizedText(
          locale,
          "Erro ao carregar cliente. Tente novamente.",
          "Unable to load client. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [slug, locale]);

  useEffect(() => {
    fetchClient();
    fetchTeamMembers();
  }, [fetchClient, fetchTeamMembers]);

  const latestVersion = client?.versions[0];
  const posts = latestVersion?.posts || [];
  const editingPost = editingPostId ? posts.find((p) => p.id === editingPostId) : null;
  const shareToken = latestVersion?.tokens[0]?.token;

  const shareUrl = client && latestVersion && shareToken
    ? `${window.location.origin}/c/${client.slug}/${latestVersion.version}?t=${shareToken}`
    : null;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateToken = async () => {
    if (
      shareUrl &&
      !window.confirm(
        tr(
          "Gerar um novo link desativa o link atual. Quem tem o link antigo perde o acesso. Continuar?",
          "Generating a new link disables the current one. Anyone with the old link loses access. Continue?"
        )
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/clients/${slug}/tokens`, { method: "POST" });
      if (res.ok) fetchClient();
    } catch (error) {
      console.error("Error generating token:", error);
    }
  };

  const openCreatePost = () => {
    setEditingPostId(null);
    setPostForm(defaultPostForm);
    setProductionForm(defaultProductionForm);
    setMaterialDraft(createEmptyMaterialDraft());
    setPendingMaterials([]);
    setShowMaterialsSection(false);
    setPostDialogOpen(true);
  };

  const openEditPost = (post: PostData) => {
    setEditingPostId(post.id);
    const d = new Date(post.scheduledAt);
    const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setPostForm({
      scheduledAt: localISO,
      channel: post.channel,
      title: post.title ?? "",
      copyText: post.copyText,
    });
    setProductionForm({
      productionStage: post.productionStage || "draft_copy",
      assigneeId: post.assigneeId ?? "",
      handoffNote: post.handoffNote ?? "",
    });
    setMaterialDraft(createEmptyMaterialDraft());
    setPendingMaterials([]);
    setShowMaterialsSection(Boolean(post.attachments?.length));
    setPostDialogOpen(true);
  };

  const resetMaterialDraft = () => setMaterialDraft(createEmptyMaterialDraft());

  const addMaterialToQueue = () => {
    if (!isMaterialDraftValid(materialDraft)) return;
    setPendingMaterials((prev) => [...prev, materialDraft]);
    resetMaterialDraft();
  };

  const removePendingMaterial = (index: number) => {
    setPendingMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPostMaterials = async (postId: string, materials: PostMaterialDraft[]) => {
    for (const draft of materials) {
      const body = buildAttachmentRequestBody(draft);
      const res = await fetch(`/api/posts/${postId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : tr("Erro ao adicionar material", "Unable to add material")
        );
      }
    }
  };

  const collectMaterialsForSave = (): PostMaterialDraft[] => {
    const queue = [...pendingMaterials];
    if (isMaterialDraftValid(materialDraft)) {
      queue.push(materialDraft);
    }
    return queue;
  };

  const handleSavePost = async () => {
    if (!client || !latestVersion) return;
    setPostSaving(true);

    try {
      const body = {
        scheduledAt: postForm.scheduledAt,
        channel: postForm.channel,
        title: postForm.title,
        copyText: postForm.copyText,
        productionStage: productionForm.productionStage,
        assigneeId: productionForm.assigneeId || null,
        handoffNote: productionForm.handoffNote.trim() || undefined,
      };
      const materials = collectMaterialsForSave();
      let postId = editingPostId;

      if (editingPostId) {
        const res = await fetch(`/api/posts/${editingPostId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : tr("Erro ao salvar publicação", "Unable to save post")
          );
        }
      } else {
        const res = await fetch(`/api/calendar/${client.slug}/${latestVersion.version}/posts/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : tr("Erro ao criar publicação", "Unable to create post")
          );
        }
        const data = await res.json();
        postId = data.post?.id;
        if (!postId) throw new Error(tr("Publicação criada sem identificador", "Post was created without an ID"));
      }

      if (materials.length > 0 && postId) {
        await uploadPostMaterials(postId, materials);
      }

      setPostDialogOpen(false);
      resetMaterialDraft();
      setPendingMaterials([]);
      setProductionForm(defaultProductionForm);
      setShowMaterialsSection(false);
      fetchClient();
    } catch (error) {
      console.error("Error saving post:", error);
      alert(error instanceof Error ? error.message : tr("Erro ao salvar publicação", "Unable to save post"));
    } finally {
      setPostSaving(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm(tr("Tem certeza que deseja excluir esta publicação?", "Are you sure you want to delete this post?"))) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || tr("Não foi possível excluir a publicação", "Unable to delete the post"));
        return;
      }
      fetchClient();
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleSaveInfo = async () => {
    setInfoSaving(true);
    try {
      await fetch(`/api/clients/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infoForm),
      });
      fetchClient();
    } catch (error) {
      console.error("Error saving info:", error);
    } finally {
      setInfoSaving(false);
    }
  };

  const getChannelStyle = (channel: string) =>
    CHANNELS.find((c) => c.value === channel)?.color || "bg-muted text-muted-foreground";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  // Group posts by date
  const postsByDate = posts.reduce<Record<string, PostData[]>>((acc, post) => {
    const dateKey = new Date(post.scheduledAt).toISOString().split("T")[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(post);
    return acc;
  }, {});


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError || !client) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{tr("Cliente", "Client")}</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              {loadError ?? tr("Cliente não encontrado.", "Client not found.")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tr(
                "A gestão interna (publicações, revisores, informações) fica em",
                "Internal management (posts, reviewers, details) lives at"
              )}{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/dashboard/clients/demo-client</code>
              {" "}-{" "}
              {tr(
                "não confunda com a visão do calendário em",
                "not to be confused with the calendar view at"
              )}{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/c/demo-client/v1</code>.
            </p>
            <Button onClick={() => router.push("/dashboard/clients")}>
              {tr("Voltar para clientes", "Back to clients")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    total: posts.length,
    approved: posts.filter((p) => p.status === "approved").length,
    pending: posts.filter((p) => p.status === "pending").length,
    adjustments: posts.filter((p) => p.status === "adjustments").length,
  };

  const calendarHref = `/c/${client.slug}/${latestVersion?.version ?? "v1"}`;

  const startImportWith = (list: FileList | File[] | null) => {
    setImportFiles(list ? Array.from(list).filter((file) => file.size > 0) : []);
    setAiImportOpen(true);
  };

  // Cliente sem publicações: a tela vazia já é o começo da importação.
  const emptyPlan = (
    <Card className="rounded-3xl">
      <CardContent className="flex flex-wrap items-stretch gap-7 p-7">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setPlanDragOver(true);
          }}
          onDragLeave={() => setPlanDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setPlanDragOver(false);
            startImportWith(e.dataTransfer.files);
          }}
          className={`flex min-w-0 flex-[3_1_420px] flex-col items-center justify-center gap-3.5 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
            planDragOver ? "border-brand bg-brand-soft" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-muted/30"
          }`}
        >
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-brand-soft text-brand">
            <Upload className="h-7 w-7" />
          </span>
          <h2 className="text-balance font-display text-2xl font-semibold leading-tight sm:text-[26px]">
            {tr("Solte aqui o planejamento do mês", "Drop this month's plan here")}
          </h2>
          <p className="max-w-sm text-muted-foreground">
            {tr(
              "PDF, planilha ou documento. A IA monta o calendário e você confere antes de criar.",
              "PDF, spreadsheet or document. The AI builds the calendar and you check it before creating."
            )}
          </p>
          <Button
            className="mt-2 h-12 rounded-2xl bg-brand px-6 text-[15px] font-semibold text-brand-foreground hover:bg-brand/90"
            onClick={() => planInputRef.current?.click()}
          >
            {tr("Escolher arquivo", "Choose file")}
          </Button>
          <input
            ref={planInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.csv,.tsv,.txt,.md,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
            className="hidden"
            onChange={(e) => {
              startImportWith(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="text-[13px] text-muted-foreground">{tr("As artes podem vir depois.", "Creatives can come later.")}</span>
        </div>

        <div className="flex min-w-0 flex-[2_1_280px] flex-col justify-center gap-6 px-2 py-3">
          <ol className="flex flex-col gap-6">
            {[
              [tr("Envie o planejamento", "Upload the plan"), tr("Do jeito que ele já existe na agência.", "Just as it already exists at the agency.")],
              [tr("Confira o calendário", "Check the calendar"), tr("Datas, canais e formatos em uma tela só.", "Dates, channels and formats on one screen.")],
              [tr("Anexe as artes quando ficarem prontas", "Attach the creatives when they are ready"), tr("Cada data fica esperando a sua arte.", "Each date waits for its creative.")],
            ].map(([title, detail], index) => (
              <li key={title} className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-semibold ${
                    index === 0 ? "bg-foreground text-background" : "border-[1.5px] border-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <strong className="font-semibold">{title}</strong>
                  <span className="text-sm text-muted-foreground">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            {tr("Prefere começar do zero?", "Prefer to start from scratch?")}{" "}
            <button type="button" onClick={openCreatePost} className="font-semibold text-foreground underline underline-offset-2">
              {tr("Criar uma publicação manualmente", "Create a post manually")}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {posts.length === 0
                ? tr("Nenhuma publicação ainda", "No posts yet")
                : posts.length === 1
                  ? tr("1 publicação", "1 post")
                  : tr(`${posts.length} publicações`, `${posts.length} posts`)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(canManage || shareUrl || shareToken) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 rounded-xl">
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  {copied ? tr("Link copiado", "Link copied") : tr("Compartilhar", "Share")}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {shareUrl && (
                  <DropdownMenuItem onSelect={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" /> {tr("Copiar link do cliente", "Copy the client link")}
                  </DropdownMenuItem>
                )}
                {canManage && (
                  <DropdownMenuItem onSelect={handleGenerateToken}>
                    <Link2 className="h-4 w-4 mr-2" /> {shareUrl ? tr("Gerar novo link", "Generate a new link") : tr("Gerar link", "Generate link")}
                  </DropdownMenuItem>
                )}
                {/* Visão do cliente usa o link da agência, que só owner/admin recebem. */}
                {shareToken && (
                  <DropdownMenuItem asChild>
                    <a href={`${calendarHref}?t=${shareToken}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" /> {tr("Ver como o cliente", "View as the client")}
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="outline" className="h-11 rounded-xl" asChild>
            <a href={calendarHref} target="_blank" rel="noopener noreferrer">
              <ImageIcon className="h-4 w-4 mr-2" />
              {tr("Calendário de produção", "Production calendar")}
            </a>
          </Button>

          {/* Qualquer papel importa: member já cria e edita posts; a cota limita o custo. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-11 rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                {tr("Nova publicação", "New post")}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={openCreatePost}>
                <Pencil className="h-4 w-4 mr-2" /> {tr("Criar manualmente", "Create manually")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => startImportWith(null)}>
                <Sparkles className="h-4 w-4 mr-2" /> {tr("Importar planejamento com IA", "Import a plan with AI")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {importNotice !== null && (
        <div role="status" className="flex items-center gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <Check aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={3} />
          <span className="flex-1">
            {importNotice === 1
              ? tr("1 publicação criada a partir do planejamento.", "1 post created from the plan.")
              : tr(`${importNotice} publicações criadas a partir do planejamento.`, `${importNotice} posts created from the plan.`)}
          </span>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-emerald-100 dark:hover:bg-emerald-900" onClick={() => setImportNotice(null)} aria-label={tr("Fechar aviso", "Dismiss")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Etapas de produção e aprovação do cliente */}
      {posts.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
            <ol className="grid min-w-0 flex-[3_1_420px] grid-cols-2 gap-3 sm:grid-cols-4">
              {PRODUCTION_STAGES.map((stage) => {
                const count = posts.filter((p) => (p.productionStage || "draft_copy") === stage.value).length;
                return (
                  <li key={stage.value} className={`flex flex-col gap-1.5 ${count ? "" : "text-muted-foreground"}`}>
                    <span aria-hidden="true" className={`h-1.5 rounded-full ${count ? "bg-brand" : "bg-muted"}`} />
                    <span className="font-display text-2xl font-semibold leading-none tabular-nums">{count}</span>
                    <span className={`text-[13px] ${count ? "font-semibold" : ""}`}>{getLocalizedProductionStageLabel(stage.value, locale)}</span>
                  </li>
                );
              })}
            </ol>
            <dl className="flex flex-[1_1_220px] flex-wrap gap-x-5 gap-y-1 text-sm">
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{stats.approved}</dd>
                <dt className="text-muted-foreground">{tr("aprovadas", "approved")}</dt>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold tabular-nums">{stats.pending}</dd>
                <dt className="text-muted-foreground">{tr("aguardando o cliente", "waiting for the client")}</dt>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold tabular-nums text-orange-700 dark:text-orange-400">{stats.adjustments}</dd>
                <dt className="text-muted-foreground">{tr("com ajustes", "with changes")}</dt>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" /> {tr("Calendário", "Calendar")}
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <FileText className="h-4 w-4" /> {tr("Lista", "List")}
          </TabsTrigger>
          <TabsTrigger value="reviewers" className="gap-2">
            <Users className="h-4 w-4" /> {tr("Revisores", "Reviewers")}
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-2">
            <Pencil className="h-4 w-4" /> {tr("Informações", "Details")}
          </TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="mt-4 space-y-6">
          {posts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {tr(
                "Planeje o calendário com data e copy - as artes podem ser adicionadas depois no calendário de produção ou ao editar a publicação.",
                "Plan the calendar with dates and copy - creatives can be added later in the production calendar or when editing the post."
              )}
            </p>
          )}
          {posts.length === 0 ? (
            emptyPlan
          ) : (
            Object.entries(postsByDate).map(([dateKey, dayPosts]) => (
              <div key={dateKey}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {formatDate(dayPosts[0].scheduledAt)}
                </h3>
                <div className="space-y-3">
                  {dayPosts.map((post) => (
                    <Card key={post.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {!post.attachments?.length && (
                            <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          {post.attachments?.[0]?.versions?.[0]?.url && (
                            <MediaThumb
                              url={post.attachments[0].versions[post.attachments[0].versions.length - 1].url}
                              alt=""
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="secondary" className={getChannelStyle(post.channel)}>
                                {post.channel}
                              </Badge>
                              <Badge variant="secondary" className={STATUS_MAP[post.status]?.class}>
                                {STATUS_MAP[post.status]
                                  ? tr(STATUS_MAP[post.status].label, STATUS_MAP[post.status].labelEn)
                                  : null}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={getProductionStageStyle(post.productionStage)}
                              >
                                {getLocalizedProductionStageLabel(post.productionStage, locale)}
                              </Badge>
                              {post.assignee && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <UserRound className="h-3 w-3" />
                                  {post.assignee.name || post.assignee.email}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatTime(post.scheduledAt)}
                              </span>
                              {post.comments.length > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {post.comments.length}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate">
                              {post.title?.trim() || tr("Sem título", "Untitled")}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{post.copyText}</p>
                          </div>
                          <div className="flex items-start gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setHandoffPost(post)}
                            >
                              {tr("Delegar", "Assign")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditPost(post)}
                              aria-label={tr("Editar publicação", "Edit post")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeletePost(post.id)}
                              aria-label={tr("Excluir publicação", "Delete post")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4">
          {posts.length === 0 ? (
            emptyPlan
          ) : (
            <Card className="rounded-3xl">
              <CardContent className="p-5">
                <PostCalendar
                  posts={posts.map((p) => ({
                    id: p.id,
                    scheduledAt: p.scheduledAt,
                    channel: p.channel,
                    title: p.title?.trim() ?? "",
                    status: p.status,
                    hasArt: Boolean(p.attachments?.length),
                  }))}
                  focusDate={calendarFocus}
                  channelClass={getChannelStyle}
                  onPostClick={(id) => {
                    const post = posts.find((p) => p.id === id);
                    if (post) openEditPost(post);
                  }}
                  onEmptyDateClick={(dateKey) => {
                    setEditingPostId(null);
                    setPostForm({
                      ...defaultPostForm,
                      scheduledAt: `${dateKey}T10:00`,
                    });
                    setPostDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reviewers Tab */}
        <TabsContent value="reviewers">
          {latestVersion ? (
            <ClientReviewersTab
              clientSlug={client.slug}
              clientId={client.id}
              clientName={client.name}
              calendarVersionId={latestVersion.id}
              calendarVersionLabel={latestVersion.version}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {tr(
                  "Crie uma versão de calendário antes de convidar revisores.",
                  "Create a calendar version before inviting reviewers."
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr("Dados do Cliente", "Client details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr("Nome", "Name")}</Label>
                  <Input readOnly={!canManage} value={infoForm.name} onChange={(e) => setInfoForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("CNPJ", "Tax ID")}</Label>
                  <Input readOnly={!canManage} value={infoForm.cnpj} onChange={(e) => setInfoForm((p) => ({ ...p, cnpj: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tr("Endereço", "Address")}</Label>
                <Input readOnly={!canManage} value={infoForm.address} onChange={(e) => setInfoForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input readOnly={!canManage} value={infoForm.website} onChange={(e) => setInfoForm((p) => ({ ...p, website: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input readOnly={!canManage} value={infoForm.instagram} onChange={(e) => setInfoForm((p) => ({ ...p, instagram: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input readOnly={!canManage} value={infoForm.facebook} onChange={(e) => setInfoForm((p) => ({ ...p, facebook: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input readOnly={!canManage} value={infoForm.linkedin} onChange={(e) => setInfoForm((p) => ({ ...p, linkedin: e.target.value }))} />
                </div>
              </div>
              {canManage ? (
                <Button onClick={handleSaveInfo} disabled={infoSaving}>
                  {infoSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tr("Salvando...", "Saving...")}</> : tr("Salvar alterações", "Save changes")}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tr(
                    "Só proprietários e administradores editam os dados do cliente.",
                    "Only owners and admins can edit client details."
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Post Create/Edit Dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>{editingPostId ? tr("Editar Publicação", "Edit post") : tr("Nova Publicação", "New post")}</DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              {tr(
                "Registre data e copy para planejar o calendário. Artes e materiais visuais são opcionais e podem ser adicionados depois.",
                "Add the date and copy to plan the calendar. Creatives and visual materials are optional and can be added later."
              )}
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 space-y-5 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr("Data e hora", "Date and time")}</Label>
                <Input
                  type="datetime-local"
                  value={postForm.scheduledAt}
                  onChange={(e) => setPostForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr("Canal", "Channel")}</Label>
                <select
                  value={postForm.channel}
                  onChange={(e) => setPostForm((p) => ({ ...p, channel: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch.value} value={ch.value}>{ch.value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("Título", "Title")}</Label>
              <Input
                value={postForm.title}
                onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={tr("Tema do post (ex.: Lançamento coleção verão)", "Post topic (e.g. Summer collection launch)")}
              />
            </div>

            <div className="space-y-2">
              <Label>{tr("Texto da publicação", "Post text")}</Label>
              <textarea
                value={postForm.copyText}
                onChange={(e) => setPostForm((p) => ({ ...p, copyText: e.target.value }))}
                rows={5}
                placeholder={tr("Escreva o texto da publicação para esta data...", "Write the post text for this date...")}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Salve só o texto para ir montando o planejamento editorial - sem obrigatoriedade de anexar imagens agora.",
                  "Save just the text to build your editorial plan - no need to attach images now."
                )}
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <div>
                <p className="text-sm font-medium">{tr("Produção e responsável", "Production and assignee")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr(
                    "Defina a etapa e transfira a tarefa para alguém do time.",
                    "Set the stage and hand the task off to someone on the team."
                  )}
                </p>
              </div>
              <PostProductionFields
                stage={productionForm.productionStage}
                assigneeId={productionForm.assigneeId}
                note={productionForm.handoffNote}
                members={teamMembers}
                onStageChange={(value) =>
                  setProductionForm((p) => ({ ...p, productionStage: value }))
                }
                onAssigneeChange={(value) =>
                  setProductionForm((p) => ({ ...p, assigneeId: value }))
                }
                onNoteChange={(value) =>
                  setProductionForm((p) => ({ ...p, handoffNote: value }))
                }
                idPrefix="post-dialog"
              />
            </div>

            {editingPost?.attachments && editingPost.attachments.length > 0 && (
              <div className="space-y-2">
                <Label>{tr("Materiais já anexados", "Attached materials")}</Label>
                <div className="flex flex-wrap gap-2">
                  {editingPost.attachments.map((att) => {
                    const cover = att.versions[att.versions.length - 1]?.url;
                    const label = att.label || getAttachmentTypeLabel(att.type, locale);
                    return (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 rounded-lg border px-2 py-1.5 bg-muted/30 text-sm"
                      >
                        {cover ? (
                          <img src={cover} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground p-1" />
                        )}
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    "Novos materiais abaixo serão adicionados à publicação ao salvar.",
                    "New materials below will be added to the post when you save."
                  )}
                </p>
              </div>
            )}

            <div className="rounded-lg border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setShowMaterialsSection((v) => !v)}
              >
                <div>
                  <p className="text-sm font-medium">{tr("Materiais visuais (opcional)", "Visual materials (optional)")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(
                      "Upload, URL, carrossel ou vídeo - pode ficar para depois do planejamento.",
                      "Upload, URL, carousel or video - this can wait until after planning."
                    )}
                  </p>
                </div>
                {showMaterialsSection ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {showMaterialsSection && (
                <div className="space-y-3 border-t p-4">
              <PostMaterialForm draft={materialDraft} onChange={setMaterialDraft} dense />

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addMaterialToQueue}
                disabled={!isMaterialDraftValid(materialDraft)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {tr("Adicionar material à publicação", "Add material to post")}
              </Button>

              {pendingMaterials.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {pendingMaterials.length}{" "}
                    {tr(
                      "material(is) na fila",
                      pendingMaterials.length === 1 ? "material queued" : "materials queued"
                    )}
                  </p>
                  <div className="space-y-2">
                    {pendingMaterials.map((draft, index) => {
                      const previewUrl =
                        draft.type === "carousel"
                          ? draft.slides.find((s) => s.url.trim())?.url
                          : draft.url;
                      return (
                        <div
                          key={`${index}-${getMaterialDraftLabel(draft, locale)}`}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {previewUrl ? (
                              <img src={previewUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                            ) : (
                              <ImageIcon className="w-10 h-10 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{getMaterialDraftLabel(draft, locale)}</p>
                              {draft.type === "carousel" && (
                                <p className="text-xs text-muted-foreground">
                                  {draft.slides.filter((s) => s.url.trim()).length} {tr("slides", "slides")}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive"
                            onClick={() => removePendingMaterial(index)}
                            aria-label={tr("Remover material", "Remove material")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t px-6 py-4 flex gap-3 bg-background">
            <Button variant="outline" onClick={() => setPostDialogOpen(false)} className="flex-1">
              {tr("Cancelar", "Cancel")}
            </Button>
            <Button
              onClick={handleSavePost}
              disabled={postSaving || !postForm.scheduledAt}
              className="flex-1"
            >
              {postSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tr("Salvando...", "Saving...")}</>
              ) : editingPostId ? tr("Salvar alterações", "Save changes") : tr("Criar Publicação", "Create post")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportFlow
        open={aiImportOpen}
        onOpenChange={(open) => {
          setAiImportOpen(open);
          if (!open) setImportFiles([]);
        }}
        clientSlug={client.slug}
        clientName={client.name}
        initialFiles={importFiles}
        onImported={({ created, firstDate }) => {
          setImportFiles([]);
          setImportNotice(created);
          setCalendarFocus(firstDate);
          setTab("calendar");
          fetchClient();
        }}
      />

      {handoffPost && (
        <PostHandoffDialog
          open={Boolean(handoffPost)}
          onOpenChange={(open) => !open && setHandoffPost(null)}
          postId={handoffPost.id}
          initialStage={handoffPost.productionStage || "draft_copy"}
          initialAssigneeId={handoffPost.assigneeId}
          members={teamMembers}
          onSuccess={fetchClient}
        />
      )}
    </div>
  );
}
