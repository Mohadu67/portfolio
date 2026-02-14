import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { query, location } = body;

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      return NextResponse.json(
        { error: "Google Search API not configured (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX)" },
        { status: 500 }
      );
    }

    const searchQuery = location ? `${query} ${location}` : query;

    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}&num=10`
    );

    if (!res.ok) {
      const error = await res.text();
      console.error("Google Search API error:", error);
      return NextResponse.json(
        { error: "Google Search API error", details: error },
        { status: res.status }
      );
    }

    const data = await res.json();

    const results = (data.items || []).map((item: any) => ({
      name: item.title || "",
      url: item.link || "",
      snippet: item.snippet || "",
      displayUrl: item.displayLink || "",
    }));

    return NextResponse.json({ results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Company search error:", errorMessage);
    return NextResponse.json(
      { error: "Search failed", details: errorMessage },
      { status: 500 }
    );
  }
}
