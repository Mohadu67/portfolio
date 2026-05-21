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

const CAREERS_LINK_PATTERNS = [
  /\b(careers?|jobs?|recrutement|recrutements|emplois?|carriere|carrieres|carrière|carrières|hiring|join-us|joinus|nous-rejoindre|nousrejoindre|postuler|work-with-us|workwithus|opportunities?|offres?-d-emploi|offres-emploi)\b/i,
];

const JOB_TITLE_KEYWORDS = [
  "stage",
  "stagiaire",
  "alternance",
  "alternant",
  "alternante",
  "apprenti",
  "apprentie",
  "développeur",
  "developpeur",
  "developer",
  "engineer",
  "ingénieur",
  "ingenieur",
  "frontend",
  "front-end",
  "front end",
  "backend",
  "back-end",
  "back end",
  "fullstack",
  "full-stack",
  "full stack",
  "devops",
  "data",
  "software",
  "tech",
  "web",
  "react",
  "node",
  "python",
  "java",
  "typescript",
  "javascript",
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cookie": "cookieconsent_status=allow; CookieConsent=true; gdpr=1; rgpd=1",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
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

  // 2. Find about/contact and legal links separately
  const aboutLinks = findAboutLinks($home, url).slice(0, 3);
  const legalLinks = findLegalLinks($home, url).slice(0, 3);

  // 3. Scrape about/contact pages → aboutText + emails
  if (aboutLinks.length > 0) {
    const aboutResults = await Promise.all(aboutLinks.map(fetchPage));
    for (const pageHtml of aboutResults) {
      if (!pageHtml) continue;
      const $page = cheerio.load(pageHtml);
      result.emails.push(...extractEmails(pageHtml));
      result.phones.push(...extractPhones($page.text()));
      if (!result.aboutText) {
        const text = extractAboutText($page);
        if (text.length > 100) result.aboutText = text;
      }
    }
  }

  // 4. Scrape legal pages → emails only (never use for aboutText)
  if (legalLinks.length > 0) {
    const legalResults = await Promise.all(legalLinks.map(fetchPage));
    for (const pageHtml of legalResults) {
      if (!pageHtml) continue;
      result.emails.push(...extractEmails(pageHtml));
    }
  }

  // 5. Fallback: get about text from homepage
  if (!result.aboutText) {
    result.aboutText = extractAboutText($home);
  }

  // Deduplicate
  result.emails = [...new Set(result.emails)];
  result.phones = [...new Set(result.phones)];

  return result;
}

// ---------- Détection page recrutement + parsing annonces ----------

export interface ScrapedJobOffer {
  title: string;
  url: string;
  snippet: string;
}

export interface ScrapedCareersPage {
  careersUrl: string | null;
  offers: ScrapedJobOffer[];
}

function findCareersLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  return findLinksByPatterns($, baseUrl, CAREERS_LINK_PATTERNS);
}

function looksLikeJobOffer(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 5 || lower.length > 250) return false;
  return JOB_TITLE_KEYWORDS.some((kw) => lower.includes(kw));
}

// Trouve la 1ère URL de page recrutement plausible à partir d'une homepage HTML.
export function findCareersPage(homeUrl: string, homeHtml: string): string | null {
  const $ = cheerio.load(homeHtml);
  const links = findCareersLinks($, homeUrl);
  // Prefer same-domain links over external ATS (lever, greenhouse, etc) for now
  try {
    const homeHost = new URL(homeUrl).hostname.replace(/^www\./, "");
    const sameDomain = links.find((l) => {
      try {
        return new URL(l).hostname.replace(/^www\./, "").endsWith(homeHost.split(".").slice(-2).join("."));
      } catch {
        return false;
      }
    });
    if (sameDomain) return sameDomain;
  } catch {
    /* ignore */
  }
  return links[0] ?? null;
}

// Scrape une page recrutement et extrait les annonces qui ressemblent à du dev.
// Heuristique large : on attrape tous les <a> dont le texte matche les keywords métier.
// L'IA filtrera plus finement ensuite via matchJobOffer().
export async function scrapeCareersPage(careersUrl: string, maxOffers = 15): Promise<ScrapedCareersPage> {
  const result: ScrapedCareersPage = { careersUrl, offers: [] };
  const html = await fetchPage(careersUrl);
  if (!html) return result;

  const $ = cheerio.load(html);
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    if (result.offers.length >= maxOffers) return;
    const href = $(el).attr("href");
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!href || !text) return;
    if (!looksLikeJobOffer(text)) return;

    let fullUrl: string;
    try {
      fullUrl = new URL(href, careersUrl).href;
    } catch {
      return;
    }
    if (!fullUrl.startsWith("http")) return;
    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);

    // Get nearby context for snippet (parent text minus the anchor itself)
    const parentText = $(el).parent().text().replace(/\s+/g, " ").trim();
    const snippet = parentText.length > text.length ? parentText.slice(0, 400) : text;

    result.offers.push({ title: text, url: fullUrl, snippet });
  });

  return result;
}

// Récupère la description complète d'une annonce depuis son URL.
export async function fetchJobDescription(offerUrl: string): Promise<string> {
  const html = await fetchPage(offerUrl);
  if (!html) return "";
  const $ = cheerio.load(html);
  // Try main content blocks — du plus spécifique au plus large
  const selectors = [
    'main', 'article', '[role="main"]',
    '[itemprop="description"]',
    '.job-description', '.description', '#description',
    '[class*="job"]', '[class*="offer"]', '[class*="vacancy"]',
  ];
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().replace(/\s+/g, " ").trim();
      if (text.length > 200) return text.slice(0, 6000);
    }
  }
  // Fallback : meta description plutôt que body.text() qui ramasse nav/footer/cookies (bruit pour Gemini).
  const metaOg = $('meta[property="og:description"]').attr("content");
  if (metaOg && metaOg.trim().length > 50) return metaOg.trim().slice(0, 6000);
  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc && metaDesc.trim().length > 50) return metaDesc.trim().slice(0, 6000);
  // Si vraiment rien d'utile, on rend "" : l'orchestrateur fera matchJobOffer sur le snippet déjà capturé.
  return "";
}
