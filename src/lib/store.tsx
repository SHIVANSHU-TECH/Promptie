"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Company, Database, Template } from "./types"
import { loadDatabase, mergeLibrary, normalize, saveDatabase } from "./storage"

type Store = {
  ready: boolean
  templates: Template[]
  companies: Company[]
  selectedCompanyId: string | null
  activeTemplateId: string | null
  setSelectedCompanyId: (id: string | null) => void
  setActiveTemplateId: (id: string | null) => void
  saveTemplate: (template: Template) => void
  deleteTemplate: (id: string) => void
  saveCompany: (company: Company) => void
  deleteCompany: (id: string) => void
  setCompanyValue: (companyId: string, key: string, value: string) => void
  importLibrary: (incoming: { templates: Template[]; companies: Company[] }) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null)

  useEffect(() => {
    setDb(loadDatabase())
  }, [])

  useEffect(() => {
    if (!db) return
    saveDatabase(db)
  }, [db])

  const api = useMemo<Store>(() => {
    const update = (fn: (current: Database) => Database) => {
      setDb((current) => (current ? normalize(fn(current)) : current))
    }

    return {
      ready: db !== null,
      templates: db?.templates ?? [],
      companies: db?.companies ?? [],
      selectedCompanyId: db?.selectedCompanyId ?? null,
      activeTemplateId: db?.activeTemplateId ?? null,
      setSelectedCompanyId: (id) => update((current) => ({ ...current, selectedCompanyId: id })),
      setActiveTemplateId: (id) => update((current) => ({ ...current, activeTemplateId: id })),
      saveTemplate: (template) =>
        update((current) => ({
          ...current,
          templates: current.templates.some((item) => item.id === template.id)
            ? current.templates.map((item) => (item.id === template.id ? template : item))
            : [...current.templates, template],
          activeTemplateId: template.id,
        })),
      deleteTemplate: (id) =>
        update((current) => ({
          ...current,
          templates: current.templates.filter((item) => item.id !== id),
        })),
      saveCompany: (company) =>
        update((current) => ({
          ...current,
          companies: current.companies.some((item) => item.id === company.id)
            ? current.companies.map((item) => (item.id === company.id ? company : item))
            : [...current.companies, company],
          selectedCompanyId: current.selectedCompanyId ?? company.id,
        })),
      deleteCompany: (id) =>
        update((current) => ({
          ...current,
          companies: current.companies.filter((item) => item.id !== id),
        })),
      setCompanyValue: (companyId, key, value) =>
        update((current) => ({
          ...current,
          companies: current.companies.map((company) =>
            company.id === companyId
              ? {
                  ...company,
                  updatedAt: Date.now(),
                  values: { ...company.values, [key]: value },
                }
              : company,
          ),
        })),
      importLibrary: (incoming) => update((current) => mergeLibrary(current, incoming)),
    }
  }, [db])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error("useStore must be used within StoreProvider")
  return store
}
