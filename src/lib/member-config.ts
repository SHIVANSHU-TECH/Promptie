import { loadDirectory, searchDirectory, type DirectoryRow } from "./sheet-directory"

export type MemberColors = {
  primary: string
  primaryHover: string
  primaryLight: string
  primaryText: string
}

export type MemberConfig = {
  name: string
  domain: string
  siteId: string
  widgetId: string
  apiPath: string
  apiBaseUrl: string
  websiteUrl: string
  logo: string
  favicon: string
  colors: MemberColors
}

const API_PATH = "/unified_proxy"
const API_BASE = "https://panel.whitelabelmd.com/unified_proxy/api/"

export type MemberInput = {
  name: string
  websiteUrl: string
  domain?: string
  siteId?: string
  widgetId?: string
  logo?: string
  favicon?: string
}

function publicUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error("Enter a full live or Lovable link, including https://")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter a full live or Lovable link, including https://")
  }
  const host = url.hostname.toLowerCase()
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  if (blocked) throw new Error("Use the public live or Lovable link.")
  return url
}

export function driveFileId(raw: string) {
  const text = raw.trim()
  if (!text) return ""
  const file = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (file) return file[1]
  const query = text.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (query) return query[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text
  return ""
}

function brandFile(name: string) {
  const words = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  return words.join("") || "Brand"
}

function memberDomain(website: URL, provided: string) {
  const typed = provided.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (typed) return typed
  const host = website.hostname.replace(/^www\./i, "")
  if (/(^|\.)lovable\.app$|(^|\.)lovableproject\.com$/i.test(host)) return ""
  if (host.startsWith("member.")) return host
  return `member.${host}`
}

function hexToRgb(hex: string) {
  const match = hex.trim().match(/^#([0-9a-f]{6})$/i)
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const
}

function rgbToHex(red: number, green: number, blue: number) {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase()
}

function expandHex(value: string) {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return ""
  const body = match[1]
  const full = body.length === 3 ? body.split("").map((char) => char + char).join("") : body
  return `#${full.toUpperCase()}`
}

function usefulColor(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const [red, green, blue] = rgb
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  if (max < 28 || min > 232) return false
  return max - min > 18
}

function darken(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return ""
  return rgbToHex(rgb[0] * 0.78, rgb[1] * 0.78, rgb[2] * 0.78)
}

function tint(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return ""
  return rgbToHex(rgb[0] + (255 - rgb[0]) * 0.9, rgb[1] + (255 - rgb[1]) * 0.9, rgb[2] + (255 - rgb[2]) * 0.9)
}

function textOn(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#FFFFFF"
  const channel = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  const [red, green, blue] = rgb.map(channel)
  const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luma > 0.45 ? "#14241E" : "#FFFFFF"
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const sat = saturation / 100
  const light = lightness / 100
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const match = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const shift = light - chroma / 2
  const sector = Math.floor(hue / 60) % 6
  const channels = [
    [chroma, match, 0],
    [match, chroma, 0],
    [0, chroma, match],
    [0, match, chroma],
    [match, 0, chroma],
    [chroma, 0, match],
  ][sector] ?? [0, 0, 0]
  return rgbToHex((channels[0] + shift) * 255, (channels[1] + shift) * 255, (channels[2] + shift) * 255)
}

function parseColor(raw: string) {
  const hex = expandHex(raw)
  if (hex) return hex
  const hsl = raw.trim().match(/hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i) ?? raw.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/)
  if (!hsl) return ""
  return hslToHex(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))
}

function cssColors(css: string) {
  const colors = new Map<string, string>()
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}{]+)/gi)) {
    const color = parseColor(match[2])
    if (color) colors.set(match[1].toLowerCase(), color)
  }
  return colors
}

function colorsFrom(css: string): MemberColors {
  const colors = cssColors(css)
  const preferred = ["--home-accent", "--brand", "--color-brand", "--accent", "--color-accent", "--primary", "--color-primary"]
  let primary = ""
  let key = ""
  for (const name of preferred) {
    const color = colors.get(name)
    if (color && usefulColor(color)) {
      primary = color
      key = name
      break
    }
  }
  if (!primary) {
    for (const [name, color] of colors) {
      if (!usefulColor(color) || /(sidebar|foreground|muted|ring|border|shadow|hover|light)/.test(name)) continue
      if (/(accent|brand)/.test(name)) {
        primary = color
        key = name
        break
      }
    }
  }
  if (!primary) {
    const theme = css.match(/theme-color"\s+content="(#[0-9a-f]{3,6})/i)
    const color = expandHex(theme?.[1] ?? "")
    if (usefulColor(color)) primary = color
  }
  if (!primary) {
    primary = [...css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((item) => expandHex(item[0])).find(usefulColor) || ""
  }
  if (!primary) return { primary: "", primaryHover: "", primaryLight: "", primaryText: "" }
  const hover = (key && colors.get(`${key}-hover`)) || [...colors.entries()].find(([name, color]) => /accent-hover$|brand-hover$/.test(name) && usefulColor(color))?.[1]
  const light =
    (key && colors.get(`${key}-light`)) ||
    ["--home-bg", "--background", "--color-background"].map((name) => colors.get(name) || "").find((color) => color && !usefulColor(color)) ||
    ""
  const ink = (key && colors.get(`${key}-foreground`)) || ""
  return {
    primary,
    primaryHover: hover || darken(primary),
    primaryLight: light || tint(primary),
    primaryText: ink || textOn(primary),
  }
}

async function readText(url: string, limit: number) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000) })
  if (!response.ok) return ""
  const text = await response.text()
  return text.slice(0, limit)
}

export async function readBrandColors(rawUrl: string) {
  const page = publicUrl(rawUrl)
  const html = await readText(page.toString(), 500_000)
  if (!html) return colorsFrom("")
  const styles = [html]
  const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
    .map((item) => item[0].match(/href=["']([^"']+)["']/i)?.[1] ?? "")
    .filter(Boolean)
    .slice(0, 3)
  for (const href of links) {
    try {
      const sheet = new URL(href, page)
      if (sheet.protocol !== "http:" && sheet.protocol !== "https:") continue
      styles.push(await readText(sheet.toString(), 250_000))
    } catch {
      /* a missing stylesheet does not block the json */
    }
  }
  return colorsFrom(styles.join("\n"))
}

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function sheetMatch(rows: DirectoryRow[], name: string, siteId: string) {
  if (siteId) {
    const exact = rows.find((row) => row.siteId === siteId)
    if (exact) return exact
  }
  const found = searchDirectory(rows, name)
  return found.length === 1 ? found[0] : found.find((row) => compact(row.name) === compact(name)) ?? null
}

export async function createMemberConfig(input: MemberInput) {
  const name = input.name.trim()
  if (!name) throw new Error("Enter the project name.")
  const website = publicUrl(input.websiteUrl)
  const rows = await loadDirectory().catch(() => [] as DirectoryRow[])
  const typedSite = input.siteId?.trim() ?? ""
  const typedWidget = input.widgetId?.trim() ?? ""
  const match = sheetMatch(rows, name, typedSite)
  const siteId = typedSite || match?.siteId || ""
  const widgetId = typedWidget || (match && (!typedSite || match.siteId === typedSite) ? match.widgetId : "") || ""
  const logoId = driveFileId(input.logo ?? "")
  const faviconId = driveFileId(input.favicon ?? "")
  const file = brandFile(name)
  const colors = await readBrandColors(website.toString()).catch(() => colorsFrom(""))
  const config: MemberConfig = {
    name,
    domain: memberDomain(website, input.domain ?? ""),
    siteId,
    widgetId,
    apiPath: API_PATH,
    apiBaseUrl: API_BASE,
    websiteUrl: website.toString(),
    logo: logoId ? `/logos/${file}logo.png` : "",
    favicon: faviconId ? `/logos/${file}.ico` : "",
    colors,
  }
  const notes = [
    match ? `${match.name} is on the sheet as site id ${match.siteId}.` : "This name is not on the sheet, so site id and widget stay as you entered them.",
    colors.primary ? `Primary color ${colors.primary} was read from the page.` : "No brand color was found on that page.",
    logoId ? `Logo file ${logoId}.` : "",
    faviconId ? `Favicon file ${faviconId}.` : "",
  ].filter(Boolean)
  return { config, note: notes.join(" ") }
}

export function memberJson(config: MemberConfig) {
  return JSON.stringify(config, null, 2)
}

export function memberRequestFromText(text: string, fallbackName: string) {
  const website = [...text.matchAll(/https?:\/\/[^\s)]+/gi)]
    .map((item) => item[0].replace(/[),.;]+$/, ""))
    .find((item) => !/drive\.google\.com|docs\.google\.com/i.test(item))
  if (!website) return null
  const drives = [...text.matchAll(/https?:\/\/drive\.google\.com\/[^\s)]+/gi)].map((item) =>
    item[0].replace(/[),.;]+$/, ""),
  )
  const logo = text.match(/logo[^\n]{0,120}(https?:\/\/\S+)/i)?.[1]?.replace(/[),.;]+$/, "") || drives[0] || ""
  const favicon = text.match(/favicon[^\n]{0,120}(https?:\/\/\S+)/i)?.[1]?.replace(/[),.;]+$/, "") || drives[1] || ""
  const named = text.match(/\bfor\s+([A-Za-z0-9][A-Za-z0-9 .&'-]{1,80})/i)?.[1]?.replace(/\s+(https?|logo|favicon).*$/i, "")
  const siteId = text.match(/\bsite\s*id\s*[:#]?\s*(\d{2,4})\b/i)?.[1] ?? ""
  const widgetId = text.match(/\bwidget(?:\s*id)?\s*[:#]?\s*([a-f0-9]{16,})\b/i)?.[1] ?? ""
  return {
    name: (named || fallbackName).trim(),
    websiteUrl: website,
    siteId,
    widgetId,
    logo,
    favicon,
  }
}
