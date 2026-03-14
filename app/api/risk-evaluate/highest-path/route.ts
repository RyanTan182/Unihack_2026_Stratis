// app/api/risk-evaluate/highest-path/route.ts
import { NextRequest, NextResponse } from "next/server"
import { buildCountryGraph, findHighestRiskPath, extractChokepointsFromPath } from "@/lib/utils"
import type { CountryRisk } from "@/components/supply-chain-map"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const countryRisks = (body?.countryRisks ?? []) as CountryRisk[]

    if (!Array.isArray(countryRisks) || countryRisks.length === 0) {
      return NextResponse.json(
        { error: "countryRisks array is required and must not be empty" },
        { status: 400 }
      )
    }

    // Build the graph from country risks
    const graph = buildCountryGraph(countryRisks)

    // Find the highest risk path
    const { path, maxRisk } = findHighestRiskPath(graph)
    console.log("📍 Highest Risk Path found:", path)
    console.log("📊 Path length:", path.length)

    // Create a risk map for extracting chokepoints
    const riskMap = new Map(countryRisks.map((r) => [r.id, r]))
    console.log("🗺️ Risk Map entries:", riskMap.size)
    console.log("🗺️ Risk Map sample (first 5):", Array.from(riskMap.entries()).slice(0, 5).map(([id, r]) => ({ id, type: r.type })))

    // Get details about each node in the path
    const pathDetails = path.map((nodeId) => {
      const node = countryRisks.find((r) => r.id === nodeId)
      return {
        id: nodeId,
        name: node?.name || nodeId,
        type: node?.type || "unknown",
        overallRisk: node?.overallRisk || 0,
      }
    })
    console.log("🎯 Path Details:", pathDetails)

    // Extract chokepoints from the path
    const chokepoints = extractChokepointsFromPath(path, riskMap)
    console.log("⚠️ Chokepoints extracted:", chokepoints)
    console.log("⚠️ Checking each path node for chokepoint:")
    path.forEach((nodeId) => {
      const node = riskMap.get(nodeId)
      console.log(`  - ${nodeId}: type=${node?.type}`)
    })

    return NextResponse.json({
      success: true,
      highestRiskPath: {
        path,
        pathDetails,
        maxRisk,
        chokepoints,
        pathLength: path.length,
      },
      computedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("highest-path evaluation failed:", error)
    return NextResponse.json(
      {
        error: "highest-path evaluation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
