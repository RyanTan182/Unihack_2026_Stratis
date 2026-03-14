import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const filePath = path.join(process.cwd(), "public", "data", "risk-snapshots.json")

    fs.writeFileSync(
      filePath,
      JSON.stringify(body, null, 2),
      "utf-8"
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}