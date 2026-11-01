import { brandOpenGraphImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

export const alt = "Approove - Content approval for agencies";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function EnglishOpenGraphImage() {
  return brandOpenGraphImage("en");
}
