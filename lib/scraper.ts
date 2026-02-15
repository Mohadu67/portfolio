export interface SearchResult {
  entreprise: string;
  poste: string;
  localisation: string;
  description: string;
  url: string;
  email?: string;
  plateforme: "JSearch" | "Adzuna" | "France Travail" | "Indeed";
}

// City → department code mapping for France Travail API
const CITY_TO_DEPT: Record<string, string> = {
  strasbourg: "67",
  paris: "75",
  lyon: "69",
  marseille: "13",
  toulouse: "31",
  nice: "06",
  nantes: "44",
  bordeaux: "33",
  lille: "59",
  rennes: "35",
  montpellier: "34",
  grenoble: "38",
  rouen: "76",
  toulon: "83",
  dijon: "21",
  metz: "57",
  mulhouse: "68",
  colmar: "68",
  reims: "51",
  orleans: "45",
  clermont: "63",
  tours: "37",
  nancy: "54",
};

// Helper to normalize and filter by location (lenient — APIs already filter by location)
function isLocationMatch(jobLocation: string, searchLocation: string): boolean {
  if (!searchLocation) return true;
  if (!jobLocation) return true; // Don't discard jobs with unknown location
  const normalized = jobLocation.toLowerCase().trim();
  const searchNorm = searchLocation.toLowerCase().trim();

  // Check if any significant word from the search matches the job location
  const searchWords = searchNorm.split(/[\s,]+/).filter((w) => w.length > 2);
  return (
    normalized === searchNorm ||
    normalized.includes(searchNorm) ||
    searchNorm.includes(normalized.split(",")[0].trim()) ||
    searchWords.some((word) => normalized.includes(word))
  );
}

/**
 * JSearch - Via RapidAPI
 */
export async function searchJSearch(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const rapidApiKey = process.env.RAPIDAPI_KEY || "";

  if (!rapidApiKey) {
    console.warn("RapidAPI key not configured for JSearch");
    return [];
  }

  try {
    const response = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(
        `${keywords} ${location}`
      )}&country=fr&num_pages=1&date_posted=month`,
      {
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": "jsearch.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      console.error(`JSearch API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.data || [])
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.employer_name || "Unknown",
        poste: job.job_title || "",
        localisation:
          [job.job_city, job.job_state].filter(Boolean).join(", ") || location,
        description: job.job_description?.substring(0, 500) || "",
        url: job.job_apply_link || "",
        plateforme: "JSearch" as const,
      }));
  } catch (error) {
    console.error("JSearch error:", error);
    return [];
  }
}

/**
 * Adzuna - Requires ADZUNA_APP_ID + ADZUNA_APP_KEY from developer.adzuna.com
 */
export async function searchAdzuna(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const appId = process.env.ADZUNA_APP_ID || "";
  const appKey = process.env.ADZUNA_APP_KEY || "";

  if (!appId || !appKey) {
    // Adzuna requires free API keys from developer.adzuna.com
    return [];
  }

  try {
    const response = await fetch(
      `https://api.adzuna.com/v1/api/jobs/fr/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(
        keywords
      )}&where=${encodeURIComponent(location)}&results_per_page=${nbResults}`
    );

    if (!response.ok) {
      console.error(`Adzuna API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.results || [])
      .filter((job: any) =>
        isLocationMatch(job.location?.display_name || "", location)
      )
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.company?.display_name || "Unknown",
        poste: job.title || "",
        localisation: job.location?.display_name || location,
        description: job.description?.substring(0, 500) || "",
        url: job.redirect_url || "",
        plateforme: "Adzuna" as const,
      }));
  } catch (error) {
    console.error("Adzuna search error:", error);
    return [];
  }
}

/**
 * France Travail - OAuth2 API
 */
export async function searchFranceTravail(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID || "";
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    console.warn("France Travail credentials not configured");
    return [];
  }

  try {
    // Get OAuth2 token (new endpoint)
    const tokenRes = await fetch(
      "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "api_offresdemploiv2 o2dsoffre",
        }).toString(),
      }
    );

    if (!tokenRes.ok) {
      console.error(`France Travail token error: ${tokenRes.status}`);
      return [];
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // Build search params: keywords + department code for location
    const searchParams = new URLSearchParams({
      motsCles: keywords,
      range: `0-${nbResults - 1}`,
    });

    // Map city name to department code
    const deptCode = CITY_TO_DEPT[location.toLowerCase().trim()];
    if (deptCode) {
      searchParams.set("departement", deptCode);
    }

    const jobRes = await fetch(
      `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${searchParams.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    // 204 = no results found (empty body)
    if (jobRes.status === 204) {
      return [];
    }

    if (!jobRes.ok) {
      console.error(`France Travail search error: ${jobRes.status}`);
      return [];
    }

    const jobData = await jobRes.json();

    return (jobData.resultats || [])
      .filter((job: any) =>
        isLocationMatch(job.lieuTravail?.libelle || "", location)
      )
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.entreprise?.nom || "Unknown",
        poste: job.intitule || "",
        localisation: job.lieuTravail?.libelle || location,
        description: job.description?.substring(0, 500) || "",
        url:
          job.origineOffre?.urlOrigine ||
          `https://candidat.francetravail.fr/offres/recherche/detail/${job.id}`,
        plateforme: "France Travail" as const,
      }));
  } catch (error) {
    console.error("France Travail search error:", error);
    return [];
  }
}

/**
 * Indeed - Via RapidAPI (indeed12)
 */
export async function searchIndeed(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const rapidApiKey = process.env.RAPIDAPI_KEY || "";

  if (!rapidApiKey) {
    console.warn("RapidAPI key not configured for Indeed");
    return [];
  }

  try {
    const response = await fetch(
      `https://indeed12.p.rapidapi.com/jobs/search?query=${encodeURIComponent(
        keywords
      )}&location=${encodeURIComponent(location)}&locality=fr&start=1`,
      {
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": "indeed12.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      console.error(`Indeed API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.hits || [])
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.company_name || "Unknown",
        poste: job.title || "",
        localisation: job.location || location,
        description: "",
        url: `https://fr.indeed.com${job.link}`,
        plateforme: "Indeed" as const,
      }));
  } catch (error) {
    console.error("Indeed search error:", error);
    return [];
  }
}
