import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

type AlternativeEntry = { country: string; risk: string; reason: string }
type CacheFile = Record<string, Record<string, AlternativeEntry[]>>

const CACHE_PATH = path.join(process.cwd(), "data", "alternatives-cache.json")

function readCache(): CacheFile {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf-8")
    return JSON.parse(raw) as CacheFile
  } catch {
    return {}
  }
}

function writeCache(cache: CacheFile) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8")
}

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId")
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 })
  }

  const cache = readCache()
  const entry = cache[productId] ?? null
  return NextResponse.json({ alternatives: entry })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { productId, alternatives } = body as {
    productId: string
    alternatives: Record<string, AlternativeEntry[]>
  }

  if (!productId || !alternatives) {
    return NextResponse.json({ error: "productId and alternatives required" }, { status: 400 })
  }

  const cache = readCache()
  cache[productId] = alternatives
  writeCache(cache)

  return NextResponse.json({ ok: true })
}
