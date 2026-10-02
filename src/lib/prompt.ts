import type { Template } from "./types"

const SLOT = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g

export function extractSlots(body: string): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const match of body.matchAll(SLOT)) {
    const key = match[1]
    if (seen.has(key)) continue
    seen.add(key)
    order.push(key)
  }
  return order
}

export function slotValue(values: Record<string, string>, key: string): string {
  return values[key]?.trim() ?? ""
}

export type PromptPart =
  | { type: "text"; text: string }
  | { type: "slot"; key: string; value: string }

export function tokenize(body: string, values: Record<string, string>): PromptPart[] {
  const parts: PromptPart[] = []
  let last = 0
  for (const match of body.matchAll(SLOT)) {
    const index = match.index ?? 0
    if (index > last) {
      parts.push({ type: "text", text: body.slice(last, index) })
    }
    const key = match[1]
    parts.push({ type: "slot", key, value: slotValue(values, key) })
    last = index + match[0].length
  }
  if (last < body.length) {
    parts.push({ type: "text", text: body.slice(last) })
  }
  return parts
}

export function fillPrompt(body: string, values: Record<string, string>): string {
  return tokenize(body, values)
    .map((part) => {
      if (part.type === "text") return part.text
      return part.value || `{{${part.key}}}`
    })
    .join("")
}

export function openSlots(body: string, values: Record<string, string>): string[] {
  return extractSlots(body).filter((key) => !slotValue(values, key))
}

export function groupTemplates(templates: Template[]): [string, Template[]][] {
  const map = new Map<string, Template[]>()
  const sorted = [...templates].sort((a, b) => a.title.localeCompare(b.title))
  for (const template of sorted) {
    const category = template.category.trim() || "General"
    const list = map.get(category) ?? []
    list.push(template)
    map.set(category, list)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

export function isSlotKey(key: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)
}

export function createId(prefix: string): string {
  const bytes = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  return `${prefix}_${bytes}`
}
