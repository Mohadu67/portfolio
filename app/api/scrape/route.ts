import { NextRequest, NextResponse } from "next/server";
import { scrapeCompanyWebsite } from "@/lib/web-scraper";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const data = await scrapeCompanyWebsite(url);

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Scraping error:", errorMessage);
    return NextResponse.json(
      { error: "Scraping failed", details: errorMessage },
      { status: 500 }
    );
  }
}
