const SHEET_ID = "1yUYM2BgSS5X30VY-LgcSCCLRo69o7cG46Uo_OxefQBk"
const SHEET_GID = "2132975865"
const SHEET_URLS = [
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`,
]
const CACHE_MS = 60_000

export type DirectoryRow = {
  siteId: string
  name: string
  codeName: string
  widgetId: string
  script: string
  active: string
}

const STOP = new Set([
  "site",
  "sites",
  "widget",
  "widgets",
  "chat",
  "code",
  "what",
  "whats",
  "which",
  "the",
  "for",
  "and",
  "with",
  "from",
  "this",
  "that",
  "please",
  "member",
  "json",
  "config",
  "portal",
  "give",
  "show",
  "find",
  "lookup",
  "available",
  "id",
])

let cache: { at: number; rows: DirectoryRow[] } | null = null

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function widgetId(script: string) {
  return script.match(/data-widget-id=["']([^"']+)["']/i)?.[1] ?? ""
}

async function fetchSheetCsv() {
  for (const url of SHEET_URLS) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
        headers: {
          Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (compatible; Promptie/1.0)",
        },
      })
      if (!response.ok) continue
      const text = await response.text()
      if (/site_id/i.test(text.slice(0, 800))) return text
    } catch {
      continue
    }
  }
  throw new Error("The checkout sheet could not be read.")
}

export async function loadDirectory() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows
  const table = parseCsv(await fetchSheetCsv())
  const header = table[0]?.map((cell) => cell.trim().toLowerCase()) ?? []
  const siteCol = header.indexOf("site_id")
  const nameCol = header.findIndex((cell) => cell === "subaccount")
  const scriptCol = header.findIndex((cell) => cell.includes("widget"))
  const codeCol = header.lastIndexOf("name")
  const activeCol = header.indexOf("active")
  const rows = table.slice(1).flatMap((cells) => {
    const siteId = (cells[siteCol] ?? "").trim()
    const name = (cells[nameCol] ?? "").trim()
    if (!/^\d+$/.test(siteId) || !name) return []
    const script = (cells[scriptCol] ?? "").trim()
    return [
      {
        siteId,
        name,
        codeName: (cells[codeCol] ?? "").trim(),
        widgetId: widgetId(script),
        script,
        active: (cells[activeCol] ?? "").trim(),
      },
    ]
  })
  cache = { at: Date.now(), rows }
  return rows
}

export function searchDirectory(rows: DirectoryRow[], query: string) {
  const text = query.trim()
  if (!text) return []
  const wantedId = text.match(/\b\d{2,4}\b/)?.[0] ?? ""
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP.has(token))
  const phrase = compact(tokens.join(" "))
  const scored = rows
    .map((row) => {
      const names = [compact(row.name), compact(row.codeName)].filter(Boolean)
      let score = 0
      if (wantedId && row.siteId === wantedId) score += 20
      if (phrase && names.some((name) => name === phrase)) score += 16
      if (phrase.length >= 4 && names.some((name) => name.includes(phrase) || phrase.includes(name))) score += 8
      for (const token of tokens) {
        if (names.some((name) => name.includes(token))) score += 4
      }
      return { row, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
  const best = scored.filter((item, index) => index === 0 || item.score >= scored[0].score - 4)
  return best.slice(0, 8).map((item) => item.row)
}

export function formatDirectory(rows: DirectoryRow[]) {
  if (!rows.length) return "That name or site id is not on the checkout sheet."
  return rows
    .map((row) => {
      const widget = row.widgetId ? `Widget id: ${row.widgetId}` : "No chat widget is on the sheet for this row."
      const state = row.active === "1" ? "active" : "inactive"
      return `${row.name} — site id ${row.siteId} (${state}). ${widget}.`
    })
    .join("\n")
}

export function asksForDirectory(text: string) {
  return /\b(site\s*id|chat\s*widget|widget\s*id|subaccount)\b/i.test(text)
}

export function asksForMemberJson(text: string) {
  return /\bmember\s*(json|config|portal)\b/i.test(text)
}
