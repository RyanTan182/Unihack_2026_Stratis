// Test file for traverseSupplyChainBFS function
import { traverseSupplyChainBFS, extractChokepointsFromPath } from '@/lib/utils'

// Mock country risks (simplified from page.tsx)
const countryRisks = [
  // Countries
  {
    id: "China",
    name: "China",
    type: "country" as const,
    connections: ["Strait of Malacca", "Singapore", "Vietnam", "Japan"],
    importRisk: 72,
    exportRisk: 68,
    overallRisk: 70,
    newsHighlights: [],
  },
  {
    id: "India",
    name: "India",
    type: "country" as const,
    connections: ["Strait of Malacca", "Strait of Hormuz", "Pakistan"],
    importRisk: 55,
    exportRisk: 48,
    overallRisk: 52,
    newsHighlights: [],
  },
  {
    id: "Germany",
    name: "Germany",
    type: "country" as const,
    connections: ["Poland", "Suez Canal"],
    importRisk: 25,
    exportRisk: 22,
    overallRisk: 24,
    newsHighlights: [],
  },
  {
    id: "Poland",
    name: "Poland",
    type: "country" as const,
    connections: ["Germany", "Ukraine"],
    importRisk: 38,
    exportRisk: 35,
    overallRisk: 37,
    newsHighlights: [],
  },
  {
    id: "Ukraine",
    name: "Ukraine",
    type: "country" as const,
    connections: ["Poland", "Bosphorus"],
    importRisk: 95,
    exportRisk: 90,
    overallRisk: 93,
    newsHighlights: [],
  },
  {
    id: "Singapore",
    name: "Singapore",
    type: "country" as const,
    connections: ["Strait of Malacca"],
    importRisk: 18,
    exportRisk: 15,
    overallRisk: 17,
    newsHighlights: [],
  },
  {
    id: "Vietnam",
    name: "Vietnam",
    type: "country" as const,
    connections: ["Strait of Malacca"],
    importRisk: 45,
    exportRisk: 42,
    overallRisk: 44,
    newsHighlights: [],
  },
  {
    id: "Pakistan",
    name: "Pakistan",
    type: "country" as const,
    connections: ["Strait of Hormuz"],
    importRisk: 72,
    exportRisk: 68,
    overallRisk: 70,
    newsHighlights: [],
  },
  {
    id: "Japan",
    name: "Japan",
    type: "country" as const,
    connections: ["Strait of Malacca"],
    importRisk: 28,
    exportRisk: 25,
    overallRisk: 27,
    newsHighlights: [],
  },

  // Chokepoints
  {
    id: "Strait of Malacca",
    name: "Strait of Malacca",
    type: "chokepoint" as const,
    connections: ["China", "Singapore", "Vietnam", "India", "Japan"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 61,
    newsHighlights: [],
  },
  {
    id: "Strait of Hormuz",
    name: "Strait of Hormuz",
    type: "chokepoint" as const,
    connections: ["India", "Pakistan"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 78,
    newsHighlights: [],
  },
  {
    id: "Bosphorus",
    name: "Bosphorus",
    type: "chokepoint" as const,
    connections: ["Ukraine"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 57,
    newsHighlights: [],
  },
  {
    id: "Suez Canal",
    name: "Suez Canal",
    type: "chokepoint" as const,
    connections: ["Germany"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 64,
    newsHighlights: [],
  },
]

// Mock supply chain item structure
const mockSupplyChain = {
  id: "component-1",
  country: "Vietnam",
  children: [
    {
      id: "component-2",
      country: "China",
      children: [
        {
          id: "material-1",
          country: "India",
          children: [],
        },
        {
          id: "material-2",
          country: "Pakistan",
          children: [],
        },
      ],
    },
    {
      id: "component-3",
      country: "Singapore",
      children: [
        {
          id: "material-3",
          country: "Germany",
          children: [
            {
              id: "resource-1",
              country: "Ukraine",
              children: [],
            },
          ],
        },
      ],
    },
  ],
}

// Run the test
console.log("=== Testing traverseSupplyChainBFS ===\n")
console.log("Root Country: Vietnam")
console.log("Supply Chain Structure:")
console.log(JSON.stringify(mockSupplyChain, null, 2))
console.log("\n---\n")

const result = traverseSupplyChainBFS(mockSupplyChain, "Vietnam", countryRisks)

console.log("✅ Test Results:\n")
console.log("Unique Countries:")
result.uniqueCountries.forEach((country) => {
  console.log(`  - ${country}`)
})

console.log("\nUnique Chokepoints:")
result.uniqueChokepoints.forEach((chokepoint) => {
  console.log(`  - ${chokepoint}`)
})

console.log("\n---\n")
console.log("Summary:")
console.log(`  Total unique countries: ${result.uniqueCountries.length}`)
console.log(`  Total unique chokepoints: ${result.uniqueChokepoints.length}`)

// Expected results:
console.log("\n---\n")
console.log("Expected Results:")
console.log("  Countries: Vietnam, China, India, Pakistan, Singapore, Germany, Ukraine (7 total)")
console.log("  Chokepoints: Strait of Malacca, Strait of Hormuz, Suez Canal, Bosphorus (4 total)")
console.log("\n  Vietnam->China: Strait of Malacca")
console.log("  China->India: Strait of Malacca")
console.log("  China->Pakistan: Strait of Malacca -> Strait of Hormuz")
console.log("  Vietnam->Singapore: Strait of Malacca")
console.log("  Singapore->Germany: Suez Canal")
console.log("  Germany->Ukraine: Bosphorus")
