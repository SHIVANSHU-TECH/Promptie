import type { Company, Database, Template } from "./types"
import { seedDatabase } from "./seed"

export const STORAGE_KEY = "promptie.v1"

export function normalize(db: Database): Database {
  const selectedCompanyId = db.companies.some((company) => company.id === db.selectedCompanyId)
    ? db.selectedCompanyId
    : (db.companies[0]?.id ?? null)
  const activeTemplateId = db.templates.some((template) => template.id === db.activeTemplateId)
    ? db.activeTemplateId
    : (db.templates[0]?.id ?? null)
  return { ...db, selectedCompanyId, activeTemplateId }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value).every((entry) => typeof entry === "string")
}

function isTemplate(value: unknown): value is Template {
  if (!value || typeof value !== "object") return false
  const template = value as Template
  return (
    typeof template.id === "string" &&
    template.id.length > 0 &&
    typeof template.title === "string" &&
    typeof template.category === "string" &&
    typeof template.description === "string" &&
    typeof template.body === "string" &&
    typeof template.updatedAt === "number"
  )
}

function isCompany(value: unknown): value is Company {
  if (!value || typeof value !== "object") return false
  const company = value as Company
  return (
    typeof company.id === "string" &&
    company.id.length > 0 &&
    typeof company.name === "string" &&
    typeof company.updatedAt === "number" &&
    isStringRecord(company.values)
  )
}

export function parseDatabase(value: unknown): Database | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<Database>
  if (record.version !== 1) return null
  if (!Array.isArray(record.templates) || !record.templates.every(isTemplate)) return null
  if (!Array.isArray(record.companies) || !record.companies.every(isCompany)) return null
  return normalize({
    version: 1,
    templates: record.templates,
    companies: record.companies,
    selectedCompanyId: typeof record.selectedCompanyId === "string" ? record.selectedCompanyId : null,
    activeTemplateId: typeof record.activeTemplateId === "string" ? record.activeTemplateId : null,
  })
}

export function loadDatabase(): Database {
  if (typeof window === "undefined") return seedDatabase()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedDatabase()
  try {
    const parsed = parseDatabase(JSON.parse(raw))
    return parsed ?? seedDatabase()
  } catch {
    return seedDatabase()
  }
}

export function saveDatabase(db: Database) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()]
}

export function mergeLibrary(
  current: Database,
  incoming: { templates: Template[]; companies: Company[] },
): Database {
  return normalize({
    ...current,
    templates: mergeById(current.templates, incoming.templates),
    companies: mergeById(current.companies, incoming.companies),
  })
}
