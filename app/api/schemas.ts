import { z } from "zod"

// ============================================
// Alternatives API Schemas
// ============================================

export const AlternativesRequestSchema = z.object({
  country: z.string().min(1),
  itemType: z.string().optional(),
  itemName: z.string().optional(),
  currentRisk: z.number().min(0).max(100).optional(),
})

export const AlternativeSchema = z.object({
  country: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  reason: z.string(),
})

export const AlternativesResponseSchema = z.object({
  alternatives: z.array(AlternativeSchema),
  raw: z.string().optional(),
})

// ============================================
// Optimize API Schemas
// ============================================

export const ComponentSchema = z.object({
  name: z.string(),
  type: z.string(),
  country: z.string(),
  children: z.array(z.unknown()).optional(),
})

export const ProductSchema = z.object({
  name: z.string(),
  country: z.string(),
  components: z.array(ComponentSchema),
})

export const OptimizeRequestSchema = z.object({
  product: ProductSchema,
})

export const OptimizeResponseSchema = z.object({
  result: z.string(),
})

// ============================================
// GDELT API Schemas
// ============================================

export const GdeltQuerySchema = z.object({
  country: z.string().min(1),
})

export const ArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  date: z.string(),
  source: z.string(),
})

export const GdeltResponseSchema = z.object({
  articles: z.array(ArticleSchema),
})

// ============================================
// Error Response Schema
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  detail: z.unknown().optional(),
})

// Type exports
export type AlternativesRequest = z.infer<typeof AlternativesRequestSchema>
export type AlternativesResponse = z.infer<typeof AlternativesResponseSchema>
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>
export type OptimizeResponse = z.infer<typeof OptimizeResponseSchema>
export type GdeltQuery = z.infer<typeof GdeltQuerySchema>
export type GdeltResponse = z.infer<typeof GdeltResponseSchema>
