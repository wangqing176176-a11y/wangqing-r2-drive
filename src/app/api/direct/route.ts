import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPublicR2BaseUrl } from "@/lib/cf";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const sanitizeHeaderValue = (value: string) => value.replaceAll("\n", " ").replaceAll("\r", " ").trim();

const encodeRFC5987ValueChars = (value: string) =>
  encodeURIComponent(value)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");

const toAsciiFallbackFilename = (value: string) => {
  const cleaned = sanitizeHeaderValue(value).replace(/[/\\"]/g, "_");
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, "_");
  return ascii.slice(0, 180) || "download";
};

const buildContentDisposition = (disposition: "attachment" | "inline", filename: string) => {
  const safeFallback = toAsciiFallbackFilename(filename);
  const encoded = encodeRFC5987ValueChars(sanitizeHeaderValue(filename));
  return `${disposition}; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
};

const encodeKeyForUrlPath = (key: string) =>
  key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") ?? searchParams.get("path") ?? "").trim();
  const download = searchParams.get("download") === "1";
  const filename = sanitizeHeaderValue(searchParams.get("filename") ?? "");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const baseUrl = getPublicR2BaseUrl();
  if (!baseUrl) return NextResponse.json({ error: "PUBLIC_R2_BASE_URL not configured" }, { status: 400 });

  const targetUrl = new URL(`${baseUrl}/${encodeKeyForUrlPath(key)}`);
  if (download) {
    const suggested = filename || key.split("/").pop() || "download";
    // S3-compatible response header overrides (works on r2.dev and most custom domains).
    targetUrl.searchParams.set("response-content-disposition", buildContentDisposition("attachment", suggested));
    targetUrl.searchParams.set("response-content-type", "application/octet-stream");
  }

  const target = targetUrl.toString();
  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
