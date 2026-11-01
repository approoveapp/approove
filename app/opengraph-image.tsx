import { brandOpenGraphImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

export const alt = "Approove - Aprovação de conteúdo para agências";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return brandOpenGraphImage("pt-BR");
}
