import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertAdmin, issueAccessToken } from "@/lib/cf";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);

    const { searchParams } = new URL(req.url);
    const key = (searchParams.get("key") ?? searchParams.get("path") ?? "").trim();
    const download = searchParams.get("download") === "1";
    const filename = (searchParams.get("filename") ?? "").trim();

    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const origin = new URL(req.url).origin;
    const payload = `object
${key}
${download ? "1" : "0"}`;
    const token = await issueAccessToken(payload, 24 * 3600);

    const url = `${origin}/api/object?key=${encodeURIComponent(key)}${download ? "&download=1" : ""}${
      filename ? `&filename=${encodeURIComponent(filename)}` : ""
    }${token ? `&token=${encodeURIComponent(token)}` : ""}`;

    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
