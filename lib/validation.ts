import { privateImportPath } from "./import/private-media-url";
import { z } from "zod";

function hasProtocol(value: string, protocols: string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Link externo (site, redes): só http/https, nunca javascript:/data:. "" vira null. */
export const optionalLinkSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || hasProtocol(value, ["http:", "https:"]), {
    message: "Use um link começando com https://",
  });

/** HTTPS externo ou caminho privado canônico; a rota confere a organização. */
export const mediaUrlSchema = z
  .string()
  .trim()
  .min(1, "URL obrigatória")
  .max(2048)
  .refine((value) => hasProtocol(value, ["https:"]) || privateImportPath(value) !== null, {
    message: "A mídia precisa de um link https://",
  });

export const mediaTypeSchema = z.enum(["image", "video"]).optional();

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug muito curto")
  .max(60, "Slug muito longo")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens");

export const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const commentTextSchema = z
  .string()
  .trim()
  .min(1, "Texto obrigatório")
  .max(5000, "Texto muito longo (máximo 5000 caracteres)");

export const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Data inválida" });

export const clientFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  cnpj: optionalTextSchema(32),
  address: optionalTextSchema(300),
  website: optionalLinkSchema,
  instagram: optionalLinkSchema,
  facebook: optionalLinkSchema,
  linkedin: optionalLinkSchema,
});
