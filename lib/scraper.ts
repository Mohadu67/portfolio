export interface SearchResult {
  entreprise: string;
  poste: string;
  localisation: string;
  description: string;
  url: string;
  email?: string;
  plateforme: "JSearch" | "Adzuna" | "France Travail";
}

/**
 * JSearch - Via RapidAPI
 */
export async function searchJSearch(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
  };

  try {
    const response = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(
        keywords
      )}&location=${encodeURIComponent(location)}&num_pages=1&date_posted=month`,
      options
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
        localisation: job.job_city || location,
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
 * Adzuna - Direct API (no auth required)
 */
export async function searchAdzuna(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const appId = process.env.ADZUNA_APP_ID || "";
  const appKey = process.env.ADZUNA_APP_KEY || "";

  if (!appId || !appKey) {
    console.warn("Adzuna credentials not configured");
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
    // Get OAuth2 token
    const tokenRes = await fetch(
      "https://api.francetravail.io/oauth/public/connect/token",
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

    // Search jobs
    const jobRes = await fetch(
      `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?motsCles=${encodeURIComponent(
        keywords
      )}&commune=${encodeURIComponent(location)}&range=0-${nbResults - 1}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!jobRes.ok) {
      console.error(`France Travail search error: ${jobRes.status}`);
      return [];
    }

    const jobData = await jobRes.json();

    return (jobData.resultats || [])
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.entreprise?.nom || "Unknown",
        poste: job.intitule || "",
        localisation: job.lieuTravail?.commune || location,
        description: job.description?.substring(0, 500) || "",
        url: job.origineOffre?.urlOrigine || "",
        plateforme: "France Travail" as const,
      }));
  } catch (error) {
    console.error("France Travail search error:", error);
    return [];
  }
}
