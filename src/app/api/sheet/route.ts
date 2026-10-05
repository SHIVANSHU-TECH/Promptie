import { NextResponse } from "next/server"
import { formatDirectory, loadDirectory, searchDirectory } from "@/lib/sheet-directory"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  try {
    const rows = await loadDirectory()
    const matches = query ? searchDirectory(rows, query) : rows.slice(0, 12)
    return NextResponse.json({
      matches: matches.map((row) => ({
        siteId: row.siteId,
        name: row.name,
        widgetId: row.widgetId,
        active: row.active === "1",
      })),
      summary: query ? formatDirectory(matches) : "",
    })
  } catch {
    return NextResponse.json({
      matches: [],
      summary: "",
      error: "The checkout sheet could not be read. Try again in a moment.",
    })
  }
}
