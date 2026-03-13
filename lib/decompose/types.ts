// lib/decompose/types.ts

export interface SupplyChainNode {
  id: string;
  name: string;
  tier: number;
  type: "product" | "subsystem" | "component" | "material" | "geography";
  status: "inferred" | "searching" | "verified" | "corrected";
  confidence: number;
  geographic_concentration: Record<string, number>;
  risk_score: number;
  risk_factors: string[];
  source: "inferred" | "industry" | "search" | "adversarial";
  search_evidence: string | null;
  correction: string | null;
  children: string[];
}

export interface TreeMetadata {
  total_nodes: number;
  verified_count: number;
  corrected_count: number;
  avg_confidence: number;
}

export interface DecompositionTree {
  product: string;
  phase: "skeleton" | "refining" | "verified";
  nodes: Record<string, SupplyChainNode>;
  root_id: string;
  metadata: TreeMetadata;
}

export type SSEEvent =
  | { type: "skeleton"; tree: DecompositionTree }
  | { type: "refining" }
  | { type: "verified"; tree: DecompositionTree }
  | { type: "done"; duration_ms: number }
  | { type: "error"; message: string };

export interface DecomposeRequest {
  product: string;
  suppliers: string[];
}

export interface StoredProduct {
  id: string;
  name: string;
  suppliers: string[];
  tree: DecompositionTree;
  durationMs: number;
  createdAt: number;
}
