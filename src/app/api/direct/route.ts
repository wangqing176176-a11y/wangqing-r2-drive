import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPublicR2BaseUrl } from "@/lib/cf";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const encodeKeyForUrlPath = (key: string) =>
  key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") ?? searchParams.get("path") ?? "").trim();
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const baseUrl = getPublicR2BaseUrl();
  if (!baseUrl) return NextResponse.json({ error: "PUBLIC_R2_BASE_URL not configured" }, { status: 400 });

  const target = `${baseUrl}/${encodeKeyForUrlPath(key)}`;
  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

