export interface SearchResult {
  entreprise: string;
  poste: string;
  localisation: string;
  description: string;
  url: string;
  email?: string;
  plateforme: "Indeed" | "LinkedIn";
}

export async function searchIndeed(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
      "x-rapidapi-host": "indeed12.p.rapidapi.com",
    },
  };

  try {
    const response = await fetch(
      `https://indeed12.p.rapidapi.com/jobs?keywords=${encodeURIComponent(
        keywords
      )}&location=${encodeURIComponent(location)}&page_size=${nbResults}`,
      options
    );

    if (!response.ok) {
      console.error(`Indeed API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.data || [])
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.company_name || "Unknown",
        poste: job.job_title || "",
        localisation: job.job_location || location,
        description: job.job_description?.substring(0, 500) || "",
        url: job.job_url || "",
        plateforme: "Indeed" as const,
      }));
  } catch (error) {
    console.error("Indeed search error:", error);
    return [];
  }
}

export async function searchLinkedIn(
  keywords: string,
  location: string,
  nbResults: number = 10
): Promise<SearchResult[]> {
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
      "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
    },
  };

  try {
    const response = await fetch(
      `https://linkedin-data-api.p.rapidapi.com/search-jobs?keywords=${encodeURIComponent(
        keywords
      )}&location=${encodeURIComponent(location)}&limit=${nbResults}`,
      options
    );

    if (!response.ok) {
      console.error(`LinkedIn API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.data || [])
      .slice(0, nbResults)
      .map((job: any) => ({
        entreprise: job.company || "Unknown",
        poste: job.title || "",
        localisation: job.location || location,
        description: job.description?.substring(0, 500) || "",
        url: job.url || "",
        plateforme: "LinkedIn" as const,
      }));
  } catch (error) {
    console.error("LinkedIn search error:", error);
    return [];
  }
}
