"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  Search,
  Users,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Crown,
  UserMinus,
  ArrowUpDown,
} from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface MemberData {
  id: string;
  role: string;
  acceptedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

const ROLE_CONFIG: Record<string, { label: string; className: string; icon: typeof Crown }> = {
  owner: {
    label: "Proprietário",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 hover:bg-purple-100",
    icon: Crown,
  },
  admin: {
    label: "Administrador",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 hover:bg-blue-100",
    icon: ShieldCheck,
  },
  member: {
    label: "Membro",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100",
    icon: Shield,
  },
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return email[0].toUpperCase();
}

export default function TeamPage() {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<{ membershipId: string; role: string } | null>(null);
  const isOwner = viewer?.role === "owner";

  // Espelha a API: só o owner mexe em admins; ninguém mexe no owner nem em si mesmo.
  const canManageMember = (member: MemberData) => {
    if (!viewer || member.role === "owner" || member.id === viewer.membershipId) return false;
    return isOwner || member.role === "member";
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch("/api/team");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setMembers(data.members);
      setViewer(data.viewer ?? null);
    } catch (err) {
      console.error("Error fetching team:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    setError("");
    setInviting(true);

    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || tr("Erro ao convidar membro", "Unable to invite member"));
        return;
      }

      setMembers((prev) => [...prev, data.member]);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
    } catch {
      setError(tr("Erro ao convidar membro", "Unable to invite member"));
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || tr("Erro ao alterar função", "Unable to change role"));
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch {
      alert(tr("Erro ao alterar função", "Unable to change role"));
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const displayName = memberName || tr("este membro", "this member");
    if (!confirm(tr(`Tem certeza que deseja remover ${displayName} da equipe?`, `Are you sure you want to remove ${displayName} from the team?`))) {
      return;
    }

    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || tr("Erro ao remover membro", "Unable to remove member"));
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      alert(tr("Erro ao remover membro", "Unable to remove member"));
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      (m.user.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      m.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tr("Time", "Team")}</h1>
          <p className="text-muted-foreground">
            {tr("Gerencie os membros da sua organização", "Manage your organization’s members")}
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {tr("Convidar membro", "Invite member")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tr("Convidar novo membro", "Invite a new member")}</DialogTitle>
              <DialogDescription>
                {tr("Envie um convite para um novo membro da equipe. Se o usuário não possuir conta, uma será criada automaticamente.", "Send an invitation to a new team member. If they don’t have an account, one will be created automatically.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-name">{tr("Nome", "Name")}</Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder={tr("Nome do membro", "Member name")}
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">{tr("Email", "Email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder={tr("nome@exemplo.com", "name@example.com")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{tr("Função", "Role")}</Label>
                <div className={`grid gap-3 ${isOwner ? "grid-cols-2" : "grid-cols-1"}`}>
                  <button
                    type="button"
                    onClick={() => setInviteRole("member")}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 transition-colors ${
                      inviteRole === "member"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-medium">{tr("Membro", "Member")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tr("Trabalha nas publicações e no fluxo de aprovação", "Works on posts and the approval flow")}
                    </span>
                  </button>
                  {isOwner && (
                  <button
                    type="button"
                    onClick={() => setInviteRole("admin")}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 transition-colors ${
                      inviteRole === "admin"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-sm font-medium">{tr("Administrador", "Admin")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tr("Gerencia clientes, equipe, links e cobrança", "Manages clients, team, links and billing")}
                    </span>
                  </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="space-y-1">
                  <p className="text-sm text-destructive">{error}</p>
                  <a href="/dashboard/settings" className="text-sm font-semibold underline">
                    {tr("Ver planos", "View plans")}
                  </a>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
              >
                {tr("Cancelar", "Cancel")}
              </Button>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail || !inviteName || inviting}
              >
                {inviting ? tr("Convidando...", "Inviting...") : tr("Enviar convite", "Send invitation")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {members.length > 1 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr("Buscar por nome ou email...", "Search by name or email...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-0">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              {search
                ? tr("Nenhum membro encontrado", "No members found")
                : tr("Nenhum membro na equipe", "No team members yet")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? tr("Tente outro termo de busca", "Try another search term")
                : tr("Comece convidando membros para sua organização", "Start by inviting members to your organization")}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {tr("Convidar membro", "Invite member")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>{tr("Membro", "Member")}</span>
              <span className="w-28 text-center">{tr("Função", "Role")}</span>
              <span className="w-28 text-center">{tr("Desde", "Since")}</span>
              <span className="w-10" />
            </div>
            <Separator />
            {filteredMembers.map((member, index) => {
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
              const RoleIcon = roleConfig.icon;

              return (
                <div key={member.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <Avatar>
                      <AvatarImage
                        src={member.user.image || undefined}
                        alt={member.user.name || member.user.email}
                      />
                      <AvatarFallback>
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                      {member.user.name || tr("Sem nome", "No name")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.user.email}
                      </p>
                    </div>

                    <Badge
                      variant="secondary"
                      className={`${roleConfig.className} gap-1 hidden sm:inline-flex w-28 justify-center`}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {member.role === "owner" ? tr("Proprietário", "Owner") : member.role === "admin" ? tr("Administrador", "Admin") : tr("Membro", "Member")}
                    </Badge>

                    <Badge
                      variant="secondary"
                      className={`${roleConfig.className} gap-1 sm:hidden`}
                    >
                      <RoleIcon className="h-3 w-3" />
                    </Badge>

                    {!member.acceptedAt && (
                      <Badge variant="outline" className="text-xs">
                        {tr("Convite pendente", "Invite pending")}
                      </Badge>
                    )}

                    <span className="text-xs text-muted-foreground w-28 text-center hidden sm:block">
                      {new Date(member.createdAt).toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>

                    {canManageMember(member) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isOwner && member.role === "member" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleChangeRole(member.id, "admin")
                              }
                            >
                              <ArrowUpDown className="mr-2 h-4 w-4" />
                              {tr("Promover a Administrador", "Promote to Admin")}
                            </DropdownMenuItem>
                          )}
                          {isOwner && member.role === "admin" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleChangeRole(member.id, "member")
                              }
                            >
                              <ArrowUpDown className="mr-2 h-4 w-4" />
                              {tr("Rebaixar a Membro", "Change to Member")}
                            </DropdownMenuItem>
                          )}
                          {isOwner && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              handleRemoveMember(
                                member.id,
                                member.user.name || member.user.email
                              )
                            }
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            {tr("Remover da equipe", "Remove from team")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!loading && members.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {members.length}{" "}
          {members.length === 1
            ? tr("membro na organização", "member in the organization")
            : tr("membros na organização", "members in the organization")}
        </p>
      )}
    </div>
  );
}
