import { NextRequest, NextResponse } from "next/server";

// Simple SSRF guard: allow only http/https and block localhost/private ranges
function isSafeExternalUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    // Block localhost and loopback
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    // Block common private ranges
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  if (!isSafeExternalUrl(urlParam)) {
    return NextResponse.json({ error: "Blocked or invalid URL" }, { status: 400 });
  }

  // Timeout to avoid long-hanging connections
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(urlParam, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      // Avoid sending sensitive headers to third parties
      headers: {
        "user-agent": req.headers.get("user-agent") || "Mozilla/5.0",
        accept: "image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream error: ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }

    const res = new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        // Cache at the edge/CDN; adjust as needed
        "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: "Fetch failed" }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}


