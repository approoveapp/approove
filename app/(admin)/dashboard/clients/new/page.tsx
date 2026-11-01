"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

export default function NewClientPage() {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    cnpj: "",
    address: "",
    website: "",
    instagram: "",
    facebook: "",
    linkedin: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "name" && !formData.slug) {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || tr("Erro ao criar cliente", "Unable to create client"));
      }

      router.push("/dashboard/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Erro desconhecido", "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{tr("Novo Cliente", "New client")}</h1>
          <p className="text-sm text-muted-foreground">
            {tr("Preencha os dados para criar um novo calendário editorial", "Enter the details to create a new editorial calendar")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr("Informações Básicas", "Basic information")}</CardTitle>
          <CardDescription>{tr("Dados principais do cliente", "Main client details")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                <p>{error}</p>
                <a href="/dashboard/settings" className="mt-2 inline-block font-semibold underline">
                  {tr("Ver planos", "View plans")}
                </a>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{tr("Nome da Empresa *", "Company name *")}</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={tr("Ex: Acme Corporation", "E.g. Acme Corporation")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">{tr("Slug da URL *", "URL slug *")}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    /c/
                  </span>
                  <Input
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    placeholder="acme-corporation"
                    required
                    pattern="[a-z0-9\-]+"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cnpj">{tr("CNPJ", "Tax ID")}</Label>
                <Input
                  id="cnpj"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={handleChange}
                  placeholder={tr("00.000.000/0000-00", "Optional")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder={tr("https://www.exemplo.com", "https://www.example.com")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{tr("Endereço", "Address")}</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={tr("Rua, Número, Bairro, Cidade - UF", "Street, number, city, state")}
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">{tr("Redes Sociais", "Social media")}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    name="instagram"
                    type="url"
                    value={formData.instagram}
                    onChange={handleChange}
                    placeholder={tr("URL do Instagram", "Instagram URL")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    name="facebook"
                    type="url"
                    value={formData.facebook}
                    onChange={handleChange}
                    placeholder={tr("URL do Facebook", "Facebook URL")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    name="linkedin"
                    type="url"
                    value={formData.linkedin}
                    onChange={handleChange}
                    placeholder={tr("URL do LinkedIn", "LinkedIn URL")}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                {tr("Cancelar", "Cancel")}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tr("Criando...", "Creating...")}
                  </>
                ) : (
                  tr("Criar Cliente", "Create client")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
