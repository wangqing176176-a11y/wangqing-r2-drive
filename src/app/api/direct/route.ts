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

const buildUpstreamUrl = (baseUrl: string, key: string) => new URL(`${baseUrl}/${encodeKeyForUrlPath(key)}`);

const buildProxyHeaders = (upstream: Response, download: boolean, suggestedFilename: string) => {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store, no-transform");
  headers.set("Accept-Ranges", "bytes");

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);

  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) headers.set("Last-Modified", lastModified);

  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  if (download) {
    headers.set("Content-Disposition", buildContentDisposition("attachment", suggestedFilename));
    headers.set("Content-Type", "application/octet-stream");
  }

  return headers;
};

const fetchUpstream = async (req: NextRequest, method: "GET" | "HEAD", url: URL) => {
  const headers = new Headers();
  const range = req.headers.get("range");
  if (range) headers.set("Range", range);
  return fetch(url, { method, headers });
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") ?? searchParams.get("path") ?? "").trim();
  const download = searchParams.get("download") === "1";
  const filename = sanitizeHeaderValue(searchParams.get("filename") ?? "");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const baseUrl = getPublicR2BaseUrl();
  if (!baseUrl) return NextResponse.json({ error: "PUBLIC_R2_BASE_URL not configured" }, { status: 400 });

  const suggested = filename || key.split("/").pop() || "download";
  const upstreamUrl = buildUpstreamUrl(baseUrl, key);
  const upstream = await fetchUpstream(req, "GET", upstreamUrl);
  const headers = buildProxyHeaders(upstream, download, suggested);
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function HEAD(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") ?? searchParams.get("path") ?? "").trim();
  const download = searchParams.get("download") === "1";
  const filename = sanitizeHeaderValue(searchParams.get("filename") ?? "");
  if (!key) return new Response(null, { status: 400 });

  const baseUrl = getPublicR2BaseUrl();
  if (!baseUrl) return new Response(null, { status: 400 });

  const suggested = filename || key.split("/").pop() || "download";
  const upstreamUrl = buildUpstreamUrl(baseUrl, key);
  const upstream = await fetchUpstream(req, "HEAD", upstreamUrl);
  const headers = buildProxyHeaders(upstream, download, suggested);
  return new Response(null, { status: upstream.status, headers });
}
