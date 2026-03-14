import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"

const THEMES = [
  "ECON_TAXATION",
  "UNREST",
  "REBELLION",
  "NATURAL_DISASTER",
]

// Validation schema
const QuerySchema = z.object({
  country: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")

  const parseResult = QuerySchema.safeParse({ country: country ?? "" })
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parseResult.error.issues },
      { status: 400 }
    )
  }

  const themeClause = THEMES.map((t) => `theme:${t}`).join(" OR ")
  // Use keyword match for the country plus supply-chain-related themes, English only
  const query = `("${country}" OR ${country}) (${themeClause}) sourcelang:english`

  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: "15",
    format: "json",
    sort: "date",
    timespan: "3months",
  })

  try {
    const url = `${GDELT_BASE}?${params.toString()}`
    const res = await fetch(url, { next: { revalidate: 300 } })

    if (!res.ok) {
      // GDELT returns empty HTML on some failures, fall back gracefully
      return NextResponse.json({ articles: [] })
    }

    const text = await res.text()
    if (!text || text.trim().startsWith("<!")) {
      // HTML error page or empty — no articles found
      return NextResponse.json({ articles: [] })
    }

    const data = JSON.parse(text)
    const articles = (data.articles ?? []).map(
      (a: { title?: string; url?: string; seendate?: string; domain?: string }) => ({
        title: (a.title ?? "Untitled").replace(/\s+/g, " ").trim(),
        url: a.url ?? "",
        date: a.seendate ?? "",
        source: a.domain ?? "",
      }),
    )

    return NextResponse.json({ articles })
  } catch {
    return NextResponse.json({ articles: [] })
  }
}
