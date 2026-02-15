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

    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "SerpAPI not configured (SERPAPI_KEY)" },
        { status: 500 }
      );
    }

    const searchQuery = location ? `${query} ${location}` : query;

    const res = await fetch(
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&gl=fr&hl=fr&num=10&api_key=${apiKey}`
    );

    if (!res.ok) {
      const error = await res.text();
      console.error("SerpAPI error:", error);
      return NextResponse.json(
        { error: "Search API error", details: error },
        { status: res.status }
      );
    }

    const data = await res.json();

    const results = (data.organic_results || []).map((item: any) => ({
      name: item.title || "",
      url: item.link || "",
      snippet: item.snippet || "",
      displayUrl: item.displayed_link || "",
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
