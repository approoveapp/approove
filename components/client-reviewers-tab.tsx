"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check, Copy, Link2, Loader2, Mail, MailWarning, Plus, Trash2, UserPlus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface OrgClient {
  id: string;
  name: string;
  slug: string;
}

interface ReviewerInvite {
  id: string;
  role: string;
  status: string;
  expiresAt: string | null;
  lastAccessAt: string | null;
  createdAt: string;
  calendarVersion: string;
  calendarVersionId: string;
  token: string | null;
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
  clients: OrgClient[];
  invites: ReviewerInvite[];
}

const ROLE_LABELS: Record<string, { pt: string; en: string }> = {
  viewer: { pt: "Visualizador", en: "Viewer" },
  reviewer: { pt: "Revisor", en: "Reviewer" },
  approver: { pt: "Aprovador", en: "Approver" },
};

interface ClientReviewersTabProps {
  clientSlug: string;
  clientId: string;
  clientName: string;
  calendarVersionId?: string;
  calendarVersionLabel?: string;
}

export function ClientReviewersTab({
  clientSlug,
  clientId,
  clientName,
  calendarVersionId,
  calendarVersionLabel,
}: ClientReviewersTabProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [orgClients, setOrgClients] = useState<OrgClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<{
    email: string;
    emailSent: boolean;
    emailSkipped: boolean;
    emailError: string | null;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "approver",
    clientIds: [clientId] as string[],
  });

  const fetchReviewers = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/clients/${clientSlug}/reviewers`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : localizedText(locale, "Erro ao carregar revisores", "Unable to load reviewers")
        );
      }
      setReviewers(data.reviewers);
      setOrgClients(data.orgClients);
      setCanManage(data.canManage === true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : localizedText(locale, "Erro ao carregar revisores", "Unable to load reviewers")
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [clientSlug, locale]);

  useEffect(() => {
    fetchReviewers();
  }, [fetchReviewers]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || form.clientIds.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientSlug}/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          calendarVersionId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || tr("Erro ao convidar", "Unable to send invite"));
      }
      const data = await res.json();
      setInviteFeedback({
        email: form.email.trim(),
        emailSent: Boolean(data.emailSent),
        emailSkipped: Boolean(data.emailSkipped),
        emailError: typeof data.emailError === "string" ? data.emailError : null,
      });
      setShowForm(false);
      setForm({ name: "", email: "", role: "approver", clientIds: [clientId] });
      await fetchReviewers();
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao convidar revisor", "Unable to invite reviewer"));
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm(tr("Revogar este convite? O link deixará de funcionar.", "Revoke this invite? The link will stop working."))) return;
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      if (!res.ok) throw new Error(tr("Erro ao revogar", "Unable to revoke"));
      await fetchReviewers();
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao revogar", "Unable to revoke"));
    }
  };

  const handleDeleteReviewer = async (reviewerId: string) => {
    if (!confirm(tr("Remover este revisor e todos os convites associados?", "Remove this reviewer and all of their invites?"))) return;
    try {
      const res = await fetch(`/api/reviewers/${reviewerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(tr("Erro ao remover", "Unable to remove"));
      await fetchReviewers();
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao remover", "Unable to remove"));
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/c/${clientSlug}/${calendarVersionLabel ?? "v1"}?t=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const toggleClient = (id: string) => {
    setForm((prev) => ({
      ...prev,
      clientIds: prev.clientIds.includes(id)
        ? prev.clientIds.filter((c) => c !== id)
        : [...prev.clientIds, id],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); fetchReviewers(); }}>
            {tr("Tentar novamente", "Try again")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold">{tr("Revisores convidados", "Invited reviewers")}</h3>
          <p className="text-sm text-muted-foreground">
            {tr("Pessoas autorizadas a revisar calendários de", "People allowed to review calendars for")}{" "}
            {clientName}{" "}
            {tr(
              "- cada uma com link próprio e empresas vinculadas.",
              "- each with their own link and linked clients."
            )}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            {showForm ? tr("Cancelar", "Cancel") : tr("Convidar revisor", "Invite reviewer")}
          </Button>
        )}
      </div>

      {canManage && showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr("Novo convite", "New invite")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder={tr("Nome completo", "Full name")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="text-sm px-3 py-2 border rounded-lg bg-background"
              />
              <input
                type="email"
                placeholder={tr("E-mail", "Email")}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="text-sm px-3 py-2 border rounded-lg bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{tr("Papel", "Role")}</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="text-sm px-3 py-2 border rounded-lg bg-background w-full sm:w-auto"
              >
                <option value="viewer">{tr("Visualizador - só visualiza", "Viewer - view only")}</option>
                <option value="reviewer">{tr("Revisor - comenta e anota", "Reviewer - comments and annotates")}</option>
                <option value="approver">{tr("Aprovador - comenta, anota e aprova", "Approver - comments, annotates and approves")}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                {tr("Empresas vinculadas (pode selecionar mais de uma)", "Linked clients (you can select more than one)")}
              </label>
              <div className="flex flex-wrap gap-2">
                {orgClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClient(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      form.clientIds.includes(c.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleCreate} disabled={saving || !form.name || !form.email || form.clientIds.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              {tr("Enviar convite", "Send invite")}
            </Button>
          </CardContent>
        </Card>
      )}

      {inviteFeedback && (
        <Card className={inviteFeedback.emailSent ? "border-green-200 dark:border-green-900" : "border-amber-200 dark:border-amber-900"}>
          <CardContent className="p-4 flex items-start gap-3">
            {inviteFeedback.emailSent ? (
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <MailWarning className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-sm">
              {inviteFeedback.emailSent ? (
                <p className="font-medium">{tr("Convite enviado para", "Invite sent to")} {inviteFeedback.email}</p>
              ) : inviteFeedback.emailSkipped ? (
                <>
                  <p className="font-medium">{tr("Convite criado - e-mail não configurado", "Invite created - email not configured")}</p>
                  <p className="text-muted-foreground">
                    {tr("Defina", "Set")} <code className="text-xs bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code> {tr("e", "and")}{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">EMAIL_FROM</code> {tr("no servidor.", "on the server.")}{" "}
                    {tr("Enquanto isso, copie o link do revisor abaixo.", "In the meantime, copy the reviewer link below.")}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">{tr("Convite criado, mas o e-mail falhou", "Invite created, but the email failed")}</p>
                  <p className="text-muted-foreground">
                    {inviteFeedback.emailError ?? tr("Não foi possível enviar o e-mail", "Unable to send the email")}{" "}
                    {tr("- copie o link manualmente na lista abaixo.", "- copy the link manually from the list below.")}
                  </p>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setInviteFeedback(null)}
              >
                {tr("Fechar", "Close")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {reviewers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {tr("Nenhum revisor convidado ainda.", "No reviewers invited yet.")}
            {canManage &&
              ` ${tr(
                "Use o botão acima para enviar um link personalizado.",
                "Use the button above to send a personal link."
              )}`}
          </CardContent>
        </Card>
      ) : (
        reviewers.map((reviewer) => (
          <Card key={reviewer.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{reviewer.name}</p>
                  <p className="text-sm text-muted-foreground">{reviewer.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {reviewer.clients.map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDeleteReviewer(reviewer.id)}
                    aria-label={tr("Remover revisor", "Remove reviewer")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {reviewer.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 text-sm flex-wrap"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={invite.status === "active" ? "default" : "secondary"}>
                        {invite.status === "revoked" ? tr("Revogado", "Revoked") : tr("Ativo", "Active")}
                      </Badge>
                      <span className="text-muted-foreground">{ROLE_LABELS[invite.role]
                          ? tr(ROLE_LABELS[invite.role].pt, ROLE_LABELS[invite.role].en)
                          : invite.role}</span>
                      <span className="text-xs text-muted-foreground">· {tr("cal.", "cal.")} {invite.calendarVersion}</span>
                      {invite.lastAccessAt && (
                        <span className="text-xs text-muted-foreground">
                          · {tr("último acesso", "last access")} {new Date(invite.lastAccessAt).toLocaleDateString(locale)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canManage && invite.token && invite.status !== "revoked" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyLink(invite.token!)}>
                            {copiedToken === invite.token ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            {copiedToken === invite.token ? tr("Copiado", "Copied") : tr("Copiar link", "Copy link")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive"
                            onClick={() => handleRevoke(invite.id)}
                          >
                            {tr("Revogar", "Revoke")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Card className="border-dashed">
        <CardContent className="p-4 flex gap-3 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {tr(
              "Cada revisor recebe um link único. O acesso é limitado às empresas selecionadas e ao papel definido.",
              "Each reviewer gets a unique link. Access is limited to the selected clients and the assigned role."
            )}{" "}
            {tr(
              "Remover um revisor desativa os links dele na hora.",
              "Removing a reviewer disables their links immediately."
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
