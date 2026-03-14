import { NextRequest, NextResponse } from "next/server"

// --- ISO 3166-1 alpha-2 country code mapping ---
// Includes alternate names from world-atlas geography (e.g. "United States of America")

const COUNTRY_TO_CODE: Record<string, string> = {
  "China": "CN",
  "United States": "US",
  "United States of America": "US",
  "Germany": "DE",
  "India": "IN",
  "Vietnam": "VN",
  "Brazil": "BR",
  "Indonesia": "ID",
  "Japan": "JP",
  "South Korea": "KR",
  "Korea, Republic of": "KR",
  "Mexico": "MX",
  "Russia": "RU",
  "Russian Federation": "RU",
  "Ukraine": "UA",
  "Taiwan": "TW",
  "Taiwan, Province of China": "TW",
  "Saudi Arabia": "SA",
  "South Africa": "ZA",
  "Turkey": "TR",
  "Thailand": "TH",
  "Malaysia": "MY",
  "Singapore": "SG",
  "Netherlands": "NL",
  "United Kingdom": "GB",
  "United Kingdom of Great Britain and Northern Ireland": "GB",
  "France": "FR",
  "Italy": "IT",
  "Spain": "ES",
  "Australia": "AU",
  "Canada": "CA",
  "Egypt": "EG",
  "Nigeria": "NG",
  "Argentina": "AR",
  "Chile": "CL",
  "Poland": "PL",
  "Bangladesh": "BD",
  "Pakistan": "PK",
  "Philippines": "PH",
  "Iran": "IR",
  "Iran, Islamic Republic of": "IR",
  "Panama": "PA",
  "United Arab Emirates": "AE",
  "Oman": "OM",
  "Qatar": "QA",
  "Yemen": "YE",
  "Djibouti": "DJ",
  "Greece": "GR",
  "Romania": "RO",
  "Bulgaria": "BG",
  "Georgia": "GE",
  "Peru": "PE",
  "Ethiopia": "ET",
  // Additional countries (often missing from risk data)
  "Algeria": "DZ",
  "Afghanistan": "AF",
  "Angola": "AO",
  "Austria": "AT",
  "Belgium": "BE",
  "Bolivia": "BO",
  "Botswana": "BW",
  "Colombia": "CO",
  "Costa Rica": "CR",
  "Cuba": "CU",
  "Czechia": "CZ",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Ecuador": "EC",
  "Finland": "FI",
  "Ghana": "GH",
  "Hong Kong": "HK",
  "Hungary": "HU",
  "Iceland": "IS",
  "Iraq": "IQ",
  "Ireland": "IE",
  "Israel": "IL",
  "Jordan": "JO",
  "Kenya": "KE",
  "Kuwait": "KW",
  "Libya": "LY",
  "Lebanon": "LB",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  "Morocco": "MA",
  "Mozambique": "MZ",
  "Myanmar": "MM",
  "Burma": "MM",
  "New Zealand": "NZ",
  "Norway": "NO",
  "Portugal": "PT",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Syria": "SY",
  "Syrian Arab Republic": "SY",
  "Tanzania": "TZ",
  "Tunisia": "TN",
  "Uganda": "UG",
  "Venezuela": "VE",
  "Zimbabwe": "ZW",
}

// --- In-memory cache with 5-minute TTL ---

interface CacheEntry {
  articles: Article[]
  timestamp: number
}

interface Article {
  title: string
  url: string
  date: string
  source: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function getCached(country: string): Article[] | null {
  const entry = cache.get(country)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(country)
    return null
  }
  return entry.articles
}

function setCache(country: string, articles: Article[]) {
  cache.set(country, { articles, timestamp: Date.now() })
}

// --- Shared filters ---

function titleMentionsCountry(title: string, country: string): boolean {
  const t = title.toLowerCase()
  const c = country.toLowerCase()
  if (t.includes(c)) return true

  const ALIASES: Record<string, string[]> = {
    "united states": ["u.s.", "us ", "usa", "american", "america"],
    "united states of america": ["u.s.", "us ", "usa", "american", "america", "united states"],
    "united kingdom": ["u.k.", "uk ", "britain", "british"],
    "united kingdom of great britain and northern ireland": ["u.k.", "uk ", "britain", "british", "united kingdom"],
    "south korea": ["korean", "seoul"],
    "korea, republic of": ["korean", "seoul", "south korea"],
    "south africa": ["south african"],
    "saudi arabia": ["saudi"],
    "united arab emirates": ["uae", "dubai", "emirati"],
  }
  return (ALIASES[c] ?? []).some((a) => t.includes(a))
}

const RELEVANCE_TERMS = [
  "trade", "tariff", "sanction", "embargo", "supply", "port", "shipping",
  "logistics", "freight", "export", "import", "customs", "inflation",
  "currency", "recession", "debt", "deficit", "gdp", "economy", "economic",
  "strike", "protest", "unrest", "disaster", "earthquake", "flood",
  "hurricane", "drought", "war", "conflict", "military", "energy", "oil",
  "gas", "commodity", "manufacturing", "factory", "mining", "agriculture",
  "investment", "regulation", "policy", "election", "government", "tax",
  "budget", "market", "stock", "bond", "rate", "bank", "finance",
  "labor", "worker", "child labor", "forced labor", "slavery", "exploitation",
]

function hasEconomicRelevance(title: string): boolean {
  const t = title.toLowerCase()
  return RELEVANCE_TERMS.some((term) => t.includes(term))
}

// --- Perplexity Search API fetcher (primary source) ---

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

async function fetchPerplexity(country: string, countryCode?: string): Promise<Article[]> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return []

  const query = `${country} supply chain trade economic risk tariff sanctions labor rights forced labor disruption news 2026`

  const body: { query: string; country?: string; max_results: number; max_tokens_per_page: number } = {
    query,
    max_results: 10,
    max_tokens_per_page: 512,
  }
  if (countryCode) body.country = countryCode

  const res = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) return []

  const data = await res.json()
  const results: { title?: string; url?: string; date?: string }[] = data.results ?? []

  return results
    .filter((r) => r.title && r.url)
    .map((r) => ({
      title: (r.title ?? "Untitled").replace(/\s+/g, " ").trim(),
      url: r.url ?? "",
      date: r.date ?? "",
      source: extractDomain(r.url ?? ""),
    }))
    .filter((a) => titleMentionsCountry(a.title, country) && hasEconomicRelevance(a.title))
    .slice(0, 10)
}

// --- GDELT fetcher (fallback) ---

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"

const GDELT_THEMES = [
  "ECON_TAXATION",
  "ECON_TRADE",
  "ECON_BANKRUPTCY",
  "UNREST",
  "REBELLION",
  "NATURAL_DISASTER",
  "CRISISLEX_T03_DEAD",
  "TAX_TRADE_DISPUTE",
]

async function fetchGdelt(country: string): Promise<Article[]> {
  const themeClause = GDELT_THEMES.map((t) => `theme:${t}`).join(" OR ")
  const query = `"${country}" (${themeClause}) sourcelang:english`

  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: "50",
    format: "json",
    sort: "HybridRel",
    timespan: "3months",
  })

  const url = `${GDELT_BASE}?${params.toString()}`
  const res = await fetch(url, { next: { revalidate: 300 } })

  if (!res.ok) return []

  const text = await res.text()
  if (!text || text.trim().startsWith("<!")) return []

  const data = JSON.parse(text)
  return (data.articles ?? [])
    .filter((a: { title?: string }) =>
      a.title && titleMentionsCountry(a.title ?? "", country) && hasEconomicRelevance(a.title ?? ""),
    )
    .slice(0, 10)
    .map(
      (a: { title?: string; url?: string; seendate?: string; domain?: string }) => ({
        title: (a.title ?? "Untitled").replace(/\s+/g, " ").trim(),
        url: a.url ?? "",
        date: a.seendate ?? "",
        source: a.domain ?? "",
      }),
    )
}

// --- Route handler ---

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")
  if (!country) {
    return NextResponse.json({ error: "country parameter required" }, { status: 400 })
  }

  const cached = getCached(country)
  if (cached) {
    return NextResponse.json({ articles: cached, source: "cache" })
  }

  const countryCode = COUNTRY_TO_CODE[country]

  let articles: Article[] = []
  let source = "none"

  // Primary: Perplexity Search API (works with or without ISO code)
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      articles = await fetchPerplexity(country, countryCode)
      if (articles.length > 0) source = "perplexity"
    } catch {
      // Perplexity failed, will fall through to GDELT
    }
  }

  // Fallback: GDELT with improved query
  if (articles.length === 0) {
    try {
      articles = await fetchGdelt(country)
      if (articles.length > 0) source = "gdelt"
    } catch {
      // Both sources failed
    }
  }

  setCache(country, articles)

  return NextResponse.json({ articles, source })
}
