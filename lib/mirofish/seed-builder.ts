// lib/mirofish/seed-builder.ts

interface GdeltEvent {
  title: string
  url: string
  date: string
  source: string
  tone?: number
}

interface NewsArticle {
  title: string
  url?: string
  snippet?: string
  source?: string
  publishedAt?: string
}

interface CountryRiskData {
  country: string
  overallRisk: number
  importRisk: number
  exportRisk: number
  summary?: string
}

interface SeedBuildInput {
  scenario: string
  countries: string[]
  gdeltEvents?: GdeltEvent[]
  newsArticles?: NewsArticle[]
  riskData?: CountryRiskData[]
}

export function buildSeedDocument(input: SeedBuildInput): string {
  const { scenario, countries, gdeltEvents, newsArticles, riskData } = input

  const sections: string[] = []

  // Header
  sections.push(`# Geopolitical Scenario Analysis: ${scenario}`)
  sections.push(`\n**Countries involved:** ${countries.join(", ")}`)
  sections.push(`**Analysis date:** ${new Date().toISOString().split("T")[0]}`)

  // Scenario description
  sections.push(`\n## Scenario`)
  sections.push(scenario)

  // GDELT events
  if (gdeltEvents && gdeltEvents.length > 0) {
    sections.push(`\n## Recent Geopolitical Events`)
    for (const event of gdeltEvents.slice(0, 20)) {
      const tone = event.tone !== undefined ? ` (tone: ${event.tone.toFixed(1)})` : ""
      sections.push(`- **${event.date}** — ${event.title}${tone} (Source: ${event.source})`)
    }
  }

  // News articles
  if (newsArticles && newsArticles.length > 0) {
    sections.push(`\n## News Analysis`)
    for (const article of newsArticles.slice(0, 15)) {
      sections.push(`- **${article.title}**`)
      if (article.snippet) {
        sections.push(`  ${article.snippet}`)
      }
      if (article.source) {
        sections.push(`  Source: ${article.source}`)
      }
    }
  }

  // Current risk context
  if (riskData && riskData.length > 0) {
    sections.push(`\n## Current Risk Context`)
    for (const risk of riskData) {
      sections.push(
        `- **${risk.country}**: Overall risk ${risk.overallRisk}/100 ` +
          `(Import: ${risk.importRisk}, Export: ${risk.exportRisk})` +
          (risk.summary ? ` — ${risk.summary}` : "")
      )
    }
  }

  // Supply chain context
  sections.push(`\n## Supply Chain Dependencies`)
  sections.push(
    `The following countries are part of active supply chains being monitored: ${countries.join(", ")}. ` +
      `Any disruptions to trade routes, tariffs, or political stability in these regions ` +
      `will have direct impact on manufacturing and logistics operations.`
  )

  return sections.join("\n")
}

export function buildSimulationRequirement(scenario: string): string {
  return (
    `Predict how ${scenario} will evolve over the next 1-6 months, focusing on:\n` +
    `- Impact on international trade and shipping routes\n` +
    `- Government policy responses (sanctions, tariffs, export controls)\n` +
    `- Military escalation or de-escalation probability\n` +
    `- Economic ripple effects on supply chains\n` +
    `- Regional stability and civilian sentiment\n` +
    `Simulate the full spectrum of geopolitical actors: government officials, ` +
    `military analysts, trade representatives, diplomats, journalists, and civilian populations.`
  )
}
