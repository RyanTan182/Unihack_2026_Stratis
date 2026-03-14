// scripts/demo-opus-pipeline.ts
// Quick demo: single Opus 4.6 call to generate a full supply chain tree
// Run: npx tsx scripts/demo-opus-pipeline.ts

import { readFileSync } from "fs";

// Load .env.local manually (no dotenv dependency)
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-opus-4";
const API_KEY = process.env.OPENROUTER_API_KEY!;

const SYSTEM = `You are a supply chain decomposition expert with deep knowledge of global manufacturing, raw materials sourcing, and geopolitical supply chain risks.

You decompose products into their full dependency tree — from finished product down to raw materials and geographic sources. You know real-world production data: which countries dominate which materials, which companies are major producers, and where concentration risks exist.

Output ONLY valid JSON matching the schema. No markdown, no explanation.`;

function buildPrompt(product: string, suppliers: string[]): string {
  const schema = JSON.stringify(
    {
      product,
      phase: "verified",
      nodes: {
        "node-example": {
          id: "node-example",
          name: "Example Component",
          tier: 1,
          type: "component",
          status: "verified",
          confidence: 0.85,
          geographic_concentration: { "China": 60, "Taiwan": 25, "South Korea": 15 },
          risk_score: 65,
          risk_factors: ["High geographic concentration", "Geopolitical tension"],
          source: "knowledge",
          search_evidence: null,
          correction: null,
          children: ["node-child-1", "node-child-2"],
        },
      },
      root_id: "node-example",
      metadata: {
        total_nodes: 1,
        verified_count: 1,
        corrected_count: 0,
        avg_confidence: 0.85,
      },
    },
    null,
    2
  );

  const supplierContext =
    suppliers.length > 0
      ? `\n\nKnown first-tier suppliers: ${suppliers.join(", ")}. Incorporate these as known entities at tier 1 with higher confidence (0.85+).`
      : "";

  return `Decompose this product into a full supply chain dependency tree:

Product: ${product}${supplierContext}

Requirements:
- Create 4-5 tiers deep: product → subsystems → components → materials → geographies
- Each node needs a unique id (use kebab-case like "node-battery-pack")
- Aim for 25-40 nodes total
- geographic_concentration: use your real-world knowledge of actual production percentages. These should reflect reality (e.g., "DRC produces ~70% of cobalt", "TSMC has ~90% of advanced node fab"). Percentages should sum to ~100 for each node.
- confidence: 0.0-1.0 based on how certain you are about the data
- risk_score: 0-100 based on supply concentration, geopolitical factors, single-source dependencies
- risk_factors: specific real risks for each node
- status: set to "verified" for well-known facts (most nodes), "inferred" for speculative claims
- source: "knowledge" for facts you're confident about, "inferred" for guesses
- Be specific: name actual companies, actual percentages, actual countries
- Self-check: after generating, mentally verify each node's geographic_concentration reflects reality. Fix any that don't.

Return JSON matching this schema:
${schema}

The "nodes" field is a flat map of id → node. Use "children" arrays to define the tree hierarchy. The "root_id" points to the top-level product node.`;
}

async function run() {
  const product = process.argv[2] || "iPhone 17";
  const suppliers = process.argv.slice(3);

  console.log(`\nProduct: ${product}`);
  if (suppliers.length) console.log(`Suppliers: ${suppliers.join(", ")}`);
  console.log(`Model: ${MODEL}`);
  console.log(`\nGenerating supply chain tree...\n`);

  const start = Date.now();

  const resp = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(product, suppliers) },
      ],
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`API error ${resp.status}: ${body}`);
    process.exit(1);
  }

  const data = await resp.json();
  const raw = data.choices[0].message.content;
  const elapsed = Date.now() - start;

  // Parse JSON (strip markdown fences if present)
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("\n").slice(1).join("\n");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3).trim();
  }

  try {
    const tree = JSON.parse(cleaned);
    const nodes = Object.values(tree.nodes) as any[];
    const withGeo = nodes.filter(
      (n: any) => Object.keys(n.geographic_concentration || {}).length > 0
    );
    const avgConf =
      nodes.reduce((s: number, n: any) => s + (n.confidence || 0), 0) / nodes.length;

    console.log(`--- Results ---`);
    console.log(`Time: ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`Nodes: ${nodes.length}`);
    console.log(`Nodes with geographic data: ${withGeo.length}/${nodes.length}`);
    console.log(`Avg confidence: ${avgConf.toFixed(2)}`);
    console.log(`\nTier breakdown:`);
    const tiers: Record<number, number> = {};
    nodes.forEach((n: any) => {
      tiers[n.tier] = (tiers[n.tier] || 0) + 1;
    });
    Object.entries(tiers)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([tier, count]) => console.log(`  Tier ${tier}: ${count} nodes`));

    console.log(`\nTop risk nodes:`);
    nodes
      .sort((a: any, b: any) => b.risk_score - a.risk_score)
      .slice(0, 5)
      .forEach((n: any) => {
        const geo = Object.entries(n.geographic_concentration || {})
          .map(([c, p]) => `${c} ${p}%`)
          .join(", ");
        console.log(
          `  ${n.name} (risk: ${n.risk_score}, conf: ${n.confidence}) — ${geo || "no geo"}`
        );
      });

    console.log(`\nFull tree written to: scripts/demo-output.json`);
    require("fs").writeFileSync(
      "scripts/demo-output.json",
      JSON.stringify(tree, null, 2)
    );
  } catch (e) {
    console.error(`JSON parse failed: ${e}`);
    console.log(`\nRaw output:\n${raw.slice(0, 500)}...`);
  }
}

run().catch(console.error);
