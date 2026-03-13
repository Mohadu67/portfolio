import * as cheerio from "cheerio";

export interface ScrapedCompanyData {
  emails: string[];
  phones: string[];
  aboutText: string;
  companyName: string;
  description: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;

const ABOUT_LINK_PATTERNS = [
  // About/Company pages
  /\b(about|a-propos|a_propos|apropos|qui-sommes-nous|qui_sommes_nous|notre-histoire|notre-equipe|notre-mission|presentation|l-association|lassociation|notre-association)\b/i,
  // Contact pages
  /\b(contact|nous-contacter|contactez-nous|get-in-touch)\b/i,
];

const LEGAL_LINK_PATTERNS = [
  // Legal/Privacy pages - HIGH PRIORITY (emails often here)
  /\b(rgpd|privacy|confidentialite|conditions|conditions-generales|cgu|cgv|legal|mentions-legales|mentions_legales|données-personnelles|donnees-personnelles|data-protection|politique-de-confidentialite|politique-confidentialite|protection-donnees|protection-données)\b/i,
  // Footer links (where legal pages are often found)
  /\b(footer|sitemap|plan-du-site|plan_du_site)\b/i,
];

function extractEmails(html: string): string[] {
  const decoded = html.replace(/&#64;/g, "@").replace(/\[at\]/gi, "@").replace(/\(at\)/gi, "@");
  const matches = decoded.match(EMAIL_REGEX) || [];
  const filtered = matches.filter(
    (e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".svg") && !e.endsWith(".gif") && !e.includes("example.com") && !e.includes("sentry")
  );
  return [...new Set(filtered)];
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches.map((p) => p.replace(/[\s.-]/g, "")))];
}

function findLinksByPatterns($: cheerio.CheerioAPI, baseUrl: string, patterns: RegExp[]): string[] {
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase();
    if (!href) return;

    const hrefLower = href.toLowerCase();
    const isMatch =
      patterns.some((p) => p.test(hrefLower)) ||
      patterns.some((p) => p.test(text));

    if (isMatch) {
      try {
        const fullUrl = new URL(href, baseUrl).href;
        if (fullUrl.startsWith("http")) links.push(fullUrl);
      } catch { /* skip invalid URLs */ }
    }
  });
  return [...new Set(links)];
}

function findAboutLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  return findLinksByPatterns($, baseUrl, ABOUT_LINK_PATTERNS);
}

function findLegalLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  return findLinksByPatterns($, baseUrl, LEGAL_LINK_PATTERNS);
}

function extractCompanyName($: cheerio.CheerioAPI): string {
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) return ogSiteName.trim();

  const title = $("title").text().trim();
  if (title) {
    // Take text before common separators
    const parts = title.split(/\s*[-|–—]\s*/);
    return parts[0].trim();
  }

  return "";
}

function extractDescription($: cheerio.CheerioAPI): string {
  const metaDesc = $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content");
  if (metaDesc) return metaDesc.trim();

  // Fallback: first meaningful paragraph
  const firstP = $("main p, article p, .content p, #content p, p")
    .filter((_, el) => $(el).text().trim().length > 50)
    .first()
    .text()
    .trim();
  return firstP.substring(0, 500);
}

function extractAboutText($: cheerio.CheerioAPI): string {
  // Try main content areas
  const selectors = [
    "main", "article", '[role="main"]',
    ".content", "#content", ".page-content",
    ".about", ".about-us", ".qui-sommes-nous",
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      const text = el.find("p").map((_, p) => $(p).text().trim()).get().join("\n\n");
      if (text.length > 100) return text.substring(0, 2000);
    }
  }

  // Fallback: all paragraphs
  const allText = $("p")
    .filter((_, el) => $(el).text().trim().length > 30)
    .map((_, el) => $(el).text().trim())
    .get()
    .join("\n\n");
  return allText.substring(0, 2000);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CurriculumBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function scrapeCompanyWebsite(url: string): Promise<ScrapedCompanyData> {
  const result: ScrapedCompanyData = {
    emails: [],
    phones: [],
    aboutText: "",
    companyName: "",
    description: "",
  };

  // 1. Fetch homepage
  const homeHtml = await fetchPage(url);
  if (!homeHtml) return result;

  const $home = cheerio.load(homeHtml);
  result.companyName = extractCompanyName($home);
  result.description = extractDescription($home);
  result.emails = extractEmails(homeHtml);
  result.phones = extractPhones($home.text());

  // 2. Find about/contact and legal links (prioritize legal pages - emails are often there)
  const aboutLinks = findAboutLinks($home, url);
  const legalLinks = findLegalLinks($home, url);

  // Combine and prioritize: legal pages first (more likely to have emails), then about/contact
  const allLinks = [...new Set([...legalLinks, ...aboutLinks])];

  // 3. Scrape multiple pages (legal + about/contact, max 6)
  const pagesToScrape = allLinks.slice(0, 6);
  const pageResults = await Promise.all(pagesToScrape.map(fetchPage));

  for (const pageHtml of pageResults) {
    if (!pageHtml) continue;
    const $page = cheerio.load(pageHtml);

    // Collect emails & phones
    result.emails.push(...extractEmails(pageHtml));
    result.phones.push(...extractPhones($page.text()));

    // Get about text from the first about-like page
    if (!result.aboutText) {
      const text = extractAboutText($page);
      if (text.length > 100) result.aboutText = text;
    }
  }

  // 4. Fallback: get about text from homepage
  if (!result.aboutText) {
    result.aboutText = extractAboutText($home);
  }

  // Deduplicate
  result.emails = [...new Set(result.emails)];
  result.phones = [...new Set(result.phones)];

  return result;
}
