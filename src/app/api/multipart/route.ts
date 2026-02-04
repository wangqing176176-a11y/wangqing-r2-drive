import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, assertAdminOrToken, getBucket, issueAccessToken } from "@/lib/cf";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type Action = "create" | "signPart" | "complete" | "abort";

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as Action | undefined;
    if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

    const key = String(body.key ?? "").trim();
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const bucket = getBucket();

    if (action === "create") {
      const contentType = typeof body.contentType === "string" ? body.contentType : undefined;
      if (!bucket.createMultipartUpload) return NextResponse.json({ error: "Multipart not supported" }, { status: 400 });
      const upload = await bucket.createMultipartUpload(key, {
        httpMetadata: contentType ? { contentType } : undefined,
      });
      return NextResponse.json({ uploadId: upload.uploadId });
    }

    if (action === "signPart") {
      const uploadId = String(body.uploadId ?? "").trim();
      const partNumber = Number(body.partNumber ?? NaN);
      if (!uploadId || !Number.isFinite(partNumber) || partNumber <= 0) {
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
      }

      const payload = `mp
${key}
${uploadId}
${partNumber}`;
      const token = await issueAccessToken(payload, 15 * 60);
      const url = `/api/multipart?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${encodeURIComponent(String(partNumber))}${
        token ? `&token=${encodeURIComponent(token)}` : ""
      }`;

      return NextResponse.json({ url });
    }

    if (action === "complete") {
      const uploadId = String(body.uploadId ?? "").trim();
      const parts = body.parts as Array<{ etag: string; partNumber: number }> | undefined;
      if (!uploadId || !parts?.length) return NextResponse.json({ error: "Missing params" }, { status: 400 });
      if (!bucket.resumeMultipartUpload) return NextResponse.json({ error: "Multipart not supported" }, { status: 400 });
      const upload = bucket.resumeMultipartUpload(key, uploadId);
      await upload.complete(parts);
      return NextResponse.json({ ok: true });
    }

    if (action === "abort") {
      const uploadId = String(body.uploadId ?? "").trim();
      if (!uploadId) return NextResponse.json({ error: "Missing params" }, { status: 400 });
      if (!bucket.resumeMultipartUpload) return NextResponse.json({ error: "Multipart not supported" }, { status: 400 });
      const upload = bucket.resumeMultipartUpload(key, uploadId);
      await upload.abort();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = String(searchParams.get("key") ?? "").trim();
    const uploadId = String(searchParams.get("uploadId") ?? "").trim();
    const partNumberStr = String(searchParams.get("partNumber") ?? "").trim();
    const partNumber = partNumberStr ? Number.parseInt(partNumberStr, 10) : NaN;

    if (!key || !uploadId || !Number.isFinite(partNumber) || partNumber <= 0) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const payload = `mp
${key}
${uploadId}
${partNumber}`;
    await assertAdminOrToken(req, searchParams, payload);

    const bucket = getBucket();
    if (!bucket.resumeMultipartUpload) {
      return NextResponse.json({ error: "Multipart not supported" }, { status: 400 });
    }

    const upload = bucket.resumeMultipartUpload(key, uploadId);
    const res = await upload.uploadPart(partNumber, req.body);

    const headers = new Headers();
    if (res?.etag) headers.set("ETag", res.etag);
    return new Response(null, { status: 200, headers });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
