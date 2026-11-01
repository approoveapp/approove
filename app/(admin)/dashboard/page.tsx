"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ExternalLink,
  FileCheck,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { getProductionStageStyle } from "@/lib/production-stages";
import { getLocalizedProductionStageLabel } from "@/components/post-production-fields";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { FirstSteps } from "@/components/first-steps";

interface ClientData {
  id: string;
  name: string;
  slug: string;
  stats: {
    pending: number;
    approved: number;
    adjustments: number;
    total: number;
  };
  latestToken?: string;
  versions: Array<{ version: string }>;
}

interface DashboardStats {
  totalClients: number;
  totalPosts: number;
  approved: number;
  pending: number;
  adjustments: number;
}

interface TaskData {
  id: string;
  channel: string;
  copyText: string;
  productionStage: string;
  scheduledAt: string;
  calendarVersion: {
    client: { slug: string; name: string };
  };
}

const COLORS = {
  approved: "#22c55e",
  pending: "#6b7280",
  adjustments: "#f97316",
};

export default function DashboardPage() {
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, en: string) => localizedText(locale, pt, en),
    [locale]
  );
  const router = useRouter();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [aiImport, setAiImport] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/clients");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(
          typeof data.error === "string"
            ? data.error
            : tr("Erro ao carregar clientes. Tente novamente.", "Unable to load clients. Please try again.")
        );
        return;
      }
      setClients(data.clients);
      setCanManage(data.canManage === true);
    } catch {
      setLoadError(tr("Erro de conexão. Verifique sua rede e tente novamente.", "Connection error. Check your network and try again."));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  const fetchMyTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/tasks/mine");
      if (!response.ok) return;
      const data = await response.json();
      setTasks(data.tasks ?? []);
    } catch {
      // tasks are optional on dashboard
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchMyTasks();
    fetch("/api/features")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAiImport(data?.aiImport === true))
      .catch(() => {});
  }, [fetchClients, fetchMyTasks]);

  const stats: DashboardStats = clients.reduce(
    (acc, client) => ({
      totalClients: acc.totalClients + 1,
      totalPosts: acc.totalPosts + client.stats.total,
      approved: acc.approved + client.stats.approved,
      pending: acc.pending + client.stats.pending,
      adjustments: acc.adjustments + client.stats.adjustments,
    }),
    { totalClients: 0, totalPosts: 0, approved: 0, pending: 0, adjustments: 0 }
  );

  const pieData = [
    { name: tr("Aprovadas", "Approved"), value: stats.approved, color: COLORS.approved },
    { name: tr("Pendentes", "Pending"), value: stats.pending, color: COLORS.pending },
    { name: tr("Ajustes", "Changes"), value: stats.adjustments, color: COLORS.adjustments },
  ].filter((d) => d.value > 0);

  const barData = clients.map((client) => ({
    name: client.name.length > 12 ? client.name.slice(0, 12) + "…" : client.name,
    approved: client.stats.approved,
    pending: client.stats.pending,
    adjustments: client.stats.adjustments,
  }));

  const approvalRate =
    stats.totalPosts > 0
      ? Math.round((stats.approved / stats.totalPosts) * 100)
      : 0;

  const openClientPage = (client: ClientData) => {
    const version = client.versions[0]?.version || "v1";
    const url = client.latestToken
      ? `/c/${client.slug}/${version}?t=${client.latestToken}`
      : `/c/${client.slug}/${version}`;
    window.open(url, "_blank");
  };

  const openClientManagement = (slug: string) => {
    router.push(`/dashboard/clients/${slug}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {tr("Visão geral do seu conteúdo e clientes", "Overview of your content and clients")}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
            <p className="text-lg font-medium">{tr("Não foi possível carregar o dashboard", "Unable to load the dashboard")}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">{loadError}</p>
            <Button className="mt-4" onClick={() => { setLoading(true); fetchClients(); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {tr("Tentar novamente", "Try again")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {tr("Visão geral do seu conteúdo e clientes", "Overview of your content and clients")}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => router.push("/dashboard/clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            {tr("Novo Cliente", "New client")}
          </Button>
        )}
      </div>

      {canManage && <FirstSteps clients={clients} aiImport={aiImport} />}

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {tr("Minhas tarefas", "My tasks")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                onClick={() =>
                  router.push(
                    `/dashboard/clients/${task.calendarVersion.client.slug}?tab=posts`
                  )
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {task.calendarVersion.client.name}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {task.copyText}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={getProductionStageStyle(task.productionStage)}
                >
                  {getLocalizedProductionStageLabel(task.productionStage, locale)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {tr("Clientes", "Clients")}
                </p>
                <p className="text-3xl font-bold">{stats.totalClients}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {tr("Aprovadas", "Approved")}
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.approved}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {tr("Pendentes", "Pending")}
                </p>
                <p className="text-3xl font-bold">{stats.pending}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                <Clock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {tr("Ajustes", "Changes")}
                </p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.adjustments}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {stats.totalPosts > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {tr("Distribuição de Status", "Status distribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold">{approvalRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {tr("Taxa de aprovação", "Approval rate")}
                    </p>
                  </div>
                  {pieData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {barData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{tr("Status por Cliente", "Status by client")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="approved" name={tr("Aprovadas", "Approved")} fill={COLORS.approved} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="pending" name={tr("Pendentes", "Pending")} fill={COLORS.pending} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="adjustments" name={tr("Ajustes", "Changes")} fill={COLORS.adjustments} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Clients List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{tr("Clientes", "Clients")}</h2>
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="sm">
              {tr("Ver todos", "View all")}
            </Button>
          </Link>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{tr("Nenhum cliente cadastrado", "No clients yet")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {canManage
                  ? tr("Comece adicionando seu primeiro cliente", "Start by adding your first client")
                  : tr("Peça a um administrador para cadastrar clientes", "Ask an admin to add clients")}
              </p>
              {canManage && (
                <Button
                  className="mt-4"
                  onClick={() => router.push("/dashboard/clients/new")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tr("Adicionar Cliente", "Add client")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => {
              const total = client.stats.total;
              const approvedPct =
                total > 0
                  ? Math.round((client.stats.approved / total) * 100)
                  : 0;

              return (
                <Card
                  key={client.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => openClientManagement(client.slug)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="overflow-hidden">
                        <h3 className="font-semibold truncate">
                          {client.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          /{client.slug}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 flex-shrink-0"
                        title={tr("Abrir calendário (visão do cliente)", "Open calendar (client view)")}
                        onClick={(e) => {
                          e.stopPropagation();
                          openClientPage(client);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          {tr("Progresso de aprovação", "Approval progress")}
                        </span>
                        <span className="font-medium">{approvedPct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${approvedPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 hover:bg-green-100"
                      >
                        {client.stats.approved} {tr("aprovadas", "approved")}
                      </Badge>
                      <Badge variant="secondary">
                        {client.stats.pending} {tr("pendentes", "pending")}
                      </Badge>
                      {client.stats.adjustments > 0 && (
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 hover:bg-orange-100"
                        >
                          {client.stats.adjustments} {tr("ajustes", "changes")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
