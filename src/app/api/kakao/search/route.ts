import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "KAKAO_REST_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&page=1&size=8`,
      { headers: { Authorization: `KakaoAK ${key}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "kakao api error",
          kakaoStatus: res.status,
          kakaoBody: text,
        },
        { status: res.status }
      );
    }
    const j = (await res.json()) as {
      documents?: Array<{ place_name: string; x: string; y: string }>;
    };
    const items = (j.documents || []).map((d) => ({
      display_name: d.place_name,
      lat: d.y,
      lon: d.x,
    }));
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || "kakao fetch failed" }, { status: 500 });
  }
}


