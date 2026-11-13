import { boundedImportBody } from "@/lib/import/request";
import { after, NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth";
import { getRequestLocale } from "@/lib/request-locale";
import { localizedText } from "@/lib/locale";
import { apiErrorResponse } from "@/lib/api-error";
import { cleanupJobMedia } from "@/lib/import/cleanup";
import { commitImport } from "@/lib/import/commit";
import { importCommitSchemaFor } from "@/lib/import/proposal";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const locale = await getRequestLocale();
  try {
    const { organization } = await requireActiveOrganization();
    const { jobId } = await params;
    const { posts } = importCommitSchemaFor(locale).parse(JSON.parse(new TextDecoder().decode(await boundedImportBody(request, 4 * 1024 * 1024, undefined, locale))));
    const result = await commitImport(jobId, organization.id, posts, locale);
    if (!result.alreadyCommitted) after(() => cleanupJobMedia(result));
    return NextResponse.json({ created: result.created, alreadyCommitted: result.alreadyCommitted });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error committing import");
    return NextResponse.json({ error: localizedText(locale, "Erro ao criar publicações. Atualize o calendário antes de tentar novamente.", "Error creating posts. Refresh the calendar before trying again.") }, { status: 500 });
  }
}
