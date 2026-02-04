import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, assertAdminOrToken, getBucket, issueAccessToken } from "@/lib/cf";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    const body = (await req.json().catch(() => ({}))) as { key?: string; filename?: string; contentType?: string };
    const key = (body.key ?? body.filename ?? "").trim();

    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const payload = `put
${key}`;
    const token = await issueAccessToken(payload, 15 * 60);

    const url = `/api/upload?key=${encodeURIComponent(key)}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    return NextResponse.json({ url });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = (searchParams.get("key") ?? "").trim();
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const payload = `put
${key}`;
    await assertAdminOrToken(req, searchParams, payload);

    const bucket = getBucket();
    const contentType = req.headers.get("content-type") || undefined;

    const result = await bucket.put(key, req.body, {
      httpMetadata: contentType ? { contentType } : undefined,
    });

    const headers = new Headers();
    if (result?.etag) headers.set("ETag", result.etag);
    return new Response(null, { status: 200, headers });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
