// Tests d'intégration pour le chantier auto-apply.
// Lance via : npx tsx scripts/test-auto-apply.ts
//
// Couvre :
//  1. Filtrage des emails (scoreContactEmail + pickBestContactEmail) — pur, déterministe
//  2. Détection de page recrutement (findCareersPage) — pur, HTML in-memory
//  3. Match de keywords d'offre (looksLikeJobOffer via scrapeCareersPage) — pur, HTML in-memory
//
// Note : ne teste PAS Gemini ni Gmail (nécessitent credentials + spam de vrais services).
// Pour ça, utilise le bouton "Test dry-run" dans /dashboard/settings.

import { scoreContactEmail, pickBestContactEmail } from "../lib/auto-apply-filters";
import { findCareersPage, scrapeCareersPage } from "../lib/web-scraper";

interface TestCase<T> {
  name: string;
  run: () => T | Promise<T>;
  assert: (actual: T) => boolean;
  format?: (actual: T) => string;
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function runTest<T>(tc: TestCase<T>) {
  try {
    const actual = await tc.run();
    if (tc.assert(actual)) {
      passed++;
      console.log(`  ✓ ${tc.name}`);
    } else {
      failed++;
      const detail = tc.format ? tc.format(actual) : JSON.stringify(actual);
      failures.push(`${tc.name}\n      → got: ${detail}`);
      console.log(`  ✗ ${tc.name}`);
      console.log(`      → got: ${detail}`);
    }
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${tc.name}\n      → threw: ${msg}`);
    console.log(`  ✗ ${tc.name} — threw: ${msg}`);
  }
}

// ---------- Section 1 : email filters ----------

async function testEmailFilters() {
  console.log("\n📧 Email filters");

  const emailCases: Array<{ email: string; companyUrl?: string; expectAccept: boolean; minScore?: number }> = [
    // Emails idéaux (high-value prefix + domaine match)
    { email: "rh@acme.com", companyUrl: "https://acme.com", expectAccept: true, minScore: 0.8 },
    { email: "recrutement@acme.fr", companyUrl: "https://www.acme.fr", expectAccept: true, minScore: 0.8 },
    { email: "careers@startup.io", companyUrl: "https://startup.io", expectAccept: true, minScore: 0.8 },
    { email: "jobs@boite.fr", companyUrl: "https://boite.fr", expectAccept: true, minScore: 0.8 },

    // Nominative
    { email: "marie.dupont@acme.com", companyUrl: "https://acme.com", expectAccept: true, minScore: 0.6 },
    { email: "j.martin@acme.com", companyUrl: "https://acme.com", expectAccept: true, minScore: 0.6 },

    // Blacklist (ne JAMAIS écrire)
    { email: "noreply@acme.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "no-reply@acme.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "support@acme.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "info@acme.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "webmaster@acme.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "newsletter@acme.com", companyUrl: "https://acme.com", expectAccept: false },

    // Génériques borderline (faible mais pas blacklist : contact, hello)
    { email: "contact@acme.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "hello@acme.com", companyUrl: "https://acme.com", expectAccept: false },

    // Free email (gmail, hotmail) — non professionnel
    { email: "rh.acme@gmail.com", companyUrl: "https://acme.com", expectAccept: false },
    { email: "recrutement@hotmail.fr", companyUrl: "https://acme.fr", expectAccept: false },

    // Format invalide
    { email: "pas-un-email", expectAccept: false },
    { email: "", expectAccept: false },
  ];

  for (const tc of emailCases) {
    await runTest({
      name: `scoreContactEmail("${tc.email}") → accept=${tc.expectAccept}${tc.minScore ? ` (min ${tc.minScore})` : ""}`,
      run: () => scoreContactEmail(tc.email, tc.companyUrl),
      assert: (s) => {
        if (s.accept !== tc.expectAccept) return false;
        if (tc.minScore !== undefined && s.score < tc.minScore) return false;
        return true;
      },
      format: (s) => `score=${s.score.toFixed(2)}, accept=${s.accept}, reasons=[${s.reasons.join(",")}]`,
    });
  }

  // pickBestContactEmail — doit choisir le meilleur d'un set mixte
  await runTest({
    name: "pickBestContactEmail prefers rh@ over contact@ and noreply@",
    run: () => pickBestContactEmail(
      ["noreply@acme.com", "contact@acme.com", "rh@acme.com", "info@acme.com"],
      "https://acme.com"
    ),
    assert: (best) => best?.email === "rh@acme.com",
    format: (best) => best ? `chose ${best.email}` : "null",
  });

  await runTest({
    name: "pickBestContactEmail returns null if only blacklisted/generic",
    run: () => pickBestContactEmail(
      ["noreply@acme.com", "support@acme.com", "info@acme.com"],
      "https://acme.com"
    ),
    assert: (best) => best === null,
    format: (best) => best ? `chose ${best.email}` : "null",
  });
}

// ---------- Section 2 : detection page recrutement ----------

async function testCareersPageDetection() {
  console.log("\n🎯 Careers page detection");

  const cases: Array<{ name: string; baseUrl: string; html: string; expect: string | null }> = [
    {
      name: "FR site avec lien /recrutement dans nav",
      baseUrl: "https://acme.fr",
      html: `<html><body><nav><a href="/">Accueil</a><a href="/a-propos">À propos</a><a href="/recrutement">Recrutement</a></nav></body></html>`,
      expect: "https://acme.fr/recrutement",
    },
    {
      name: "EN site avec /careers",
      baseUrl: "https://startup.io",
      html: `<html><body><a href="https://startup.io/careers">Careers</a></body></html>`,
      expect: "https://startup.io/careers",
    },
    {
      name: "Site avec /nous-rejoindre dans le footer",
      baseUrl: "https://boite.fr",
      html: `<html><body><footer><a href="/nous-rejoindre">Nous rejoindre</a></footer></body></html>`,
      expect: "https://boite.fr/nous-rejoindre",
    },
    {
      name: "Site sans aucune page carrière",
      baseUrl: "https://acme.com",
      html: `<html><body><a href="/a-propos">About</a><a href="/contact">Contact</a></body></html>`,
      expect: null,
    },
  ];

  for (const tc of cases) {
    await runTest({
      name: tc.name,
      run: () => findCareersPage(tc.baseUrl, tc.html),
      assert: (result) => result === tc.expect,
      format: (result) => `got "${result}"`,
    });
  }
}

// ---------- Section 3 : parsing annonces sur page careers (with local server) ----------

async function testJobOfferParsing() {
  console.log("\n💼 Job offer parsing");

  // Spin up a local HTTP server pour simuler une page careers
  const http = await import("node:http");
  const html = `<html><body>
    <h1>Nos offres</h1>
    <ul>
      <li><a href="/jobs/stage-dev-fullstack">Stage Développeur Fullstack (React/Node)</a><p>Stage 3 mois à Strasbourg</p></li>
      <li><a href="/jobs/alternance-frontend">Alternance Frontend React</a><p>Rentrée septembre 2026</p></li>
      <li><a href="/jobs/senior-architect">Senior Software Architect (10+ ans)</a><p>Lead technique</p></li>
      <li><a href="/jobs/commercial">Commercial B2B</a><p>Pas pour Mohammed</p></li>
    </ul>
  </body></html>`;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("Could not start test server");
  }
  const url = `http://127.0.0.1:${addr.port}/careers`;

  try {
    await runTest({
      name: "scrapeCareersPage extrait les annonces avec keywords dev/stage/alternance",
      run: () => scrapeCareersPage(url, 10),
      assert: (page) => {
        const titles = page.offers.map((o) => o.title.toLowerCase());
        // Doit récupérer les 3 offres tech (fullstack, frontend, architect) et idéalement skip commercial
        const hasFullstack = titles.some((t) => t.includes("fullstack"));
        const hasFrontend = titles.some((t) => t.includes("frontend"));
        const hasArchitect = titles.some((t) => t.includes("architect"));
        const hasCommercial = titles.some((t) => t.includes("commercial"));
        // commercial doit être absent (pas de keyword dev/stage/alternance dans le titre)
        return hasFullstack && hasFrontend && hasArchitect && !hasCommercial;
      },
      format: (page) => `${page.offers.length} offres trouvées : ${page.offers.map((o) => o.title).join(" | ")}`,
    });
  } finally {
    server.close();
  }
}

// ---------- Main ----------

async function main() {
  console.log("🧪 Tests d'intégration — auto-apply pipeline\n");

  await testEmailFilters();
  await testCareersPageDetection();
  await testJobOfferParsing();

  console.log(`\n📊 Résultat : ${passed} ok, ${failed} ko\n`);
  if (failed > 0) {
    console.log("Détails des échecs :");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("💥 Test runner crashed:", err);
  process.exit(1);
});
