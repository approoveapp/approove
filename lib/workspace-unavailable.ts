import { localizedText, type AppLocale } from "@/lib/locale";

export const WORKSPACE_UNAVAILABLE_CODE = "WORKSPACE_UNAVAILABLE";
export const WORKSPACE_UNAVAILABLE_MESSAGE =
  "Este espaço está temporariamente indisponível. Entre em contato com a equipe responsável pelo conteúdo.";
export const WORKSPACE_UNAVAILABLE_MESSAGE_EN =
  "This workspace is temporarily unavailable. Please contact the team responsible for the content.";

export function workspaceUnavailableMessage(locale: AppLocale) {
  return localizedText(locale, WORKSPACE_UNAVAILABLE_MESSAGE, WORKSPACE_UNAVAILABLE_MESSAGE_EN);
}
