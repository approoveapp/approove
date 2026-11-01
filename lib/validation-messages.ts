import { localizedText, type AppLocale } from "@/lib/locale";

/**
 * Tradução das mensagens personalizadas dos schemas zod (que ficam em português).
 * `apiErrorResponse` usa este mapa para responder no idioma da requisição sem que os
 * schemas, que são constantes de módulo, dependam do locale. A chave precisa ser
 * idêntica à mensagem do schema; mensagens fora do mapa saem como estão.
 */
const VALIDATION_MESSAGES_EN: Record<string, string> = {
  // lib/validation.ts
  "Use um link começando com https://": "Use a link starting with https://",
  "URL obrigatória": "URL is required.",
  "A mídia precisa de um link https://": "Media needs an https:// link.",
  "Slug muito curto": "Slug is too short.",
  "Slug muito longo": "Slug is too long.",
  "Use só letras minúsculas, números e hífens": "Use only lowercase letters, numbers, and hyphens.",
  "Texto obrigatório": "Text is required.",
  "Texto muito longo (máximo 5000 caracteres)": "Text is too long (max 5000 characters).",
  "Data inválida": "Invalid date.",
  "Nome é obrigatório": "Name is required.",
  // lib/email-address.ts
  "Email inválido": "Invalid email.",
  "Senha deve ter pelo menos 8 caracteres": "Password must be at least 8 characters.",
  "Senha muito longa": "Password is too long.",
  // Schemas das rotas em app/api
  "Token obrigatório": "Token is required.",
  "Nome deve ter pelo menos 2 caracteres": "Name must be at least 2 characters.",
  "Nome da empresa deve ter pelo menos 2 caracteres": "Company name must be at least 2 characters.",
  "Nome da empresa muito longo": "Company name is too long.",
  "Função deve ser 'admin' ou 'member'": "Role must be 'admin' or 'member'.",
  "Selecione ao menos um cliente": "Select at least one client.",
  "Papel inválido": "Invalid role.",
};

export function localizeValidationMessage(message: string, locale: AppLocale): string {
  if (locale === "pt-BR") return message;
  return VALIDATION_MESSAGES_EN[message] ?? message;
}

export function invalidDataMessage(locale: AppLocale) {
  return localizedText(locale, "Dados inválidos", "Invalid data.");
}
