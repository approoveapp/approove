import { NextResponse } from "next/server";
import { importFeatureEnabled } from "@/lib/import/feature";

/** Feature switches the signed-in UI needs to show or hide entry points. */
export async function GET() {
  return NextResponse.json({ aiImport: importFeatureEnabled() });
}
