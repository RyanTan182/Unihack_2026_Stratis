import { readFileSync } from "fs";
import { writeFileSync } from "fs";

const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const model = process.argv[2] || "google/gemini-2.5-flash";
const label = model.split("/").pop();

console.log(`Model: ${model}`);
console.log("Generating...\n");

const start = Date.now();
const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a supply chain decomposition expert with deep knowledge of global manufacturing, raw materials sourcing, and geopolitical supply chain risks. You decompose products into their full dependency tree. Output ONLY valid JSON. No markdown, no explanation.",
      },
      {
        role: "user",
        content: `Decompose iPhone 17 into a full supply chain dependency tree.

Requirements:
- 4-5 tiers deep: product → subsystems → components → materials → geographies
- 25-40 nodes total, each with unique kebab-case id
- geographic_concentration: use real-world production percentages summing to ~100
- Name actual companies in risk_factors
- confidence: 0.0-1.0, risk_score: 0-100
- status: "verified" for well-known facts, "inferred" for guesses
- Self-check: verify each node's geographic_concentration reflects reality

Return JSON: { product, phase: "verified", nodes: { "node-id": { id, name, tier, type, status, confidence, geographic_concentration: {country: pct}, risk_score, risk_factors: [], source: "knowledge", search_evidence: null, correction: null, children: [] } }, root_id, metadata: { total_nodes, verified_count, corrected_count: 0, avg_confidence } }`,
      },
    ],
    temperature: 0.3,
  }),
});

if (!resp.ok) {
  console.error(`API error: ${resp.status} ${await resp.text()}`);
  process.exit(1);
}

const data = await resp.json();
if (!data.choices) {
  console.error("No choices:", JSON.stringify(data).slice(0, 500));
  process.exit(1);
}

const elapsed = Date.now() - start;
const raw = data.choices[0].message.content;

let cleaned = raw.trim();
if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n");
if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim();

try {
  const tree = JSON.parse(cleaned);
  const nodes = Object.values(tree.nodes);
  const withGeo = nodes.filter(
    (n) => Object.keys(n.geographic_concentration || {}).length > 0
  );
  const avgConf =
    nodes.reduce((s, n) => s + (n.confidence || 0), 0) / nodes.length;

  console.log(`Time: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Nodes: ${nodes.length}`);
  console.log(`Nodes with geo: ${withGeo.length}/${nodes.length}`);
  console.log(`Avg confidence: ${avgConf.toFixed(2)}`);
  console.log("\nTop 5 risk nodes:");
  nodes
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5)
    .forEach((n) => {
      const geo = Object.entries(n.geographic_concentration || {})
        .map(([c, p]) => `${c} ${p}%`)
        .join(", ");
      console.log(`  ${n.name} (risk:${n.risk_score} conf:${n.confidence}) — ${geo}`);
    });

  writeFileSync(`scripts/demo-output-${label}.json`, JSON.stringify(tree, null, 2));
  console.log(`\nOutput: scripts/demo-output-${label}.json`);
} catch (e) {
  console.error("JSON parse error:", e.message);
  console.log("Raw (first 500):", cleaned.slice(0, 500));
}
