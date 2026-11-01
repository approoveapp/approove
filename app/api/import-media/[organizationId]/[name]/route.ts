import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/auth";
import { validateShareToken } from "@/lib/share-access";
import { readDevMedia } from "@/lib/media-storage";
import { privateImportPath } from "@/lib/import/private-media-url";
import { sniffMedia } from "@/lib/file-sniff";
import { apiErrorResponse } from "@/lib/api-error";
import { getRequestLocale } from "@/lib/request-locale";
import { CLIENT_VISIBLE_PRODUCTION_STAGE } from "@/lib/client-content-boundary";

/** Same-origin bytes: never redirect the browser or provider to a private Blob URL. */
export async function GET(request: NextRequest, {params}: {params:Promise<{organizationId:string;name:string}>}) {
  try {
    const {organizationId,name}=await params;
    const url=`/api/import-media/${organizationId}/${name}`;
    if(!privateImportPath(url)) return new NextResponse(null,{status:404});
    const token=request.nextUrl.searchParams.get("t");
    if(token) {
      const access=await validateShareToken(token);
      if(!access.ok) return new NextResponse(null,{status:access.status});
      // A valid token grants only assets actually attached to its calendar, never draft uploads.
      const post=await prisma.postItem.findFirst({where:{calendarVersionId:access.access.calendarVersionId,
        productionStage:CLIENT_VISIBLE_PRODUCTION_STAGE,
        calendarVersion:{client:{organizationId}},
        OR: [
          {attachments:{some:{versions:{some:{OR:[{url},{slides:{some:{url}}}]}}}}},
          {statusEvents:{some:{visibility:"client",creativesSnapshot:{contains:JSON.stringify(url)}}}},
        ],
      },select:{id:true}});
      if(!post) return new NextResponse(null,{status:404});
    } else {
      const {organization}=await requireActiveOrganization();
      if(organization.id!==organizationId) return new NextResponse(null,{status:404});
    }
    const bytes=await readDevMedia(url);
    if(!bytes) return new NextResponse(null,{status:404});
    const media=sniffMedia(bytes);
    if(!media) return new NextResponse(null,{status:404});
    const headers = new Headers({
      "Content-Type": media.mime, "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'",
    });
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = 0, end = bytes.length - 1;
      let valid = !!match && !!(match[1] || match[2]);
      if (match) {
        if (!match[1]) {
          const suffix = Number(match[2]);
          valid = valid && Number.isSafeInteger(suffix) && suffix > 0;
          start = Math.max(0, bytes.length - suffix);
        } else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(Number(match[2]), end);
          valid = valid && Number.isSafeInteger(start) && Number.isSafeInteger(Number(match[2] || end));
        }
      }
      if (!valid || start >= bytes.length || start > end) {
        headers.set("Content-Range", `bytes */${bytes.length}`);
        return new NextResponse(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
      headers.set("Content-Length", String(end - start + 1));
      return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers });
    }
    headers.set("Content-Length", String(bytes.length));
    return new NextResponse(new Uint8Array(bytes), { headers });
  } catch(error) {
    const handled=apiErrorResponse(error, await getRequestLocale()); if(handled)return handled;
    console.error("Private import media read failed");
    return new NextResponse(null,{status:503});
  }
}
