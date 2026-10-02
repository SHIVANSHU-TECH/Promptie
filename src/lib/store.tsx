"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore"
import type { Company, Template } from "./types"
import { COMPANIES, db, META, TEMPLATES } from "./firebase"
import { seedDatabase } from "./seed"

type Store = {
  ready: boolean
  error: string | null
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

type UiPrefs = { selectedCompanyId: string | null; activeTemplateId: string | null }

const StoreContext = createContext<Store | null>(null)
const UI_KEY = "promptie.ui"
const emptyUi: UiPrefs = { selectedCompanyId: null, activeTemplateId: null }
const uiListeners = new Set<() => void>()
let uiPrefs: UiPrefs = emptyUi
let uiLoaded = false
let seedStarted = false

function ensureUi() {
  if (uiLoaded || typeof window === "undefined") return
  uiLoaded = true
  try {
    const raw = window.localStorage.getItem(UI_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<UiPrefs>
    uiPrefs = {
      selectedCompanyId: typeof parsed.selectedCompanyId === "string" ? parsed.selectedCompanyId : null,
      activeTemplateId: typeof parsed.activeTemplateId === "string" ? parsed.activeTemplateId : null,
    }
  } catch {
    uiPrefs = emptyUi
  }
}

function subscribeUi(listener: () => void) {
  uiListeners.add(listener)
  return () => uiListeners.delete(listener)
}

function getUiSnapshot() {
  ensureUi()
  return uiPrefs
}

function getUiServer() {
  return emptyUi
}

function setUi(next: UiPrefs) {
  ensureUi()
  uiPrefs = next
  window.localStorage.setItem(UI_KEY, JSON.stringify(next))
  for (const listener of uiListeners) listener()
}

function asTemplate(id: string, data: DocumentData): Template | null {
  if (typeof data.title !== "string" || typeof data.body !== "string") return null
  return {
    id,
    title: data.title,
    category: typeof data.category === "string" ? data.category : "General",
    description: typeof data.description === "string" ? data.description : "",
    body: data.body,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  }
}

function asCompany(id: string, data: DocumentData): Company | null {
  if (typeof data.name !== "string") return null
  const values =
    data.values && typeof data.values === "object" && !Array.isArray(data.values)
      ? Object.fromEntries(
          Object.entries(data.values as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {}
  return {
    id,
    name: data.name,
    values,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  }
}

function firebaseMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : ""
  if (code.includes("permission-denied")) {
    return "Firestore blocked Promptie. Allow read and write on promptie_templates, promptie_companies, and promptie_meta."
  }
  return "Could not reach Firebase."
}

async function seedIfEmpty(templateCount: number, companyCount: number) {
  if (templateCount > 0 || companyCount > 0 || seedStarted) return
  seedStarted = true
  const seed = seedDatabase()
  const metaRef = doc(db, META, "library")
  try {
    await runTransaction(db, async (tx) => {
      const meta = await tx.get(metaRef)
      if (meta.exists() && meta.data()?.seeded === true) return
      tx.set(metaRef, { seeded: true, seededAt: Date.now() })
      for (const template of seed.templates) {
        tx.set(doc(db, TEMPLATES, template.id), template)
      }
      for (const company of seed.companies) {
        tx.set(doc(db, COMPANIES, company.id), company)
      }
    })
  } catch (error) {
    seedStarted = false
    throw error
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const ui = useSyncExternalStore(subscribeUi, getUiSnapshot, getUiServer)
  const [templates, setTemplates] = useState<Template[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [templatesReady, setTemplatesReady] = useState(false)
  const [companiesReady, setCompaniesReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingValues = useRef(new Map<string, Record<string, string>>())
  const companiesRef = useRef<Company[]>([])
  const writeTail = useRef(new Map<string, Promise<void>>())
  const ready = templatesReady && companiesReady

  useEffect(() => {
    let latestTemplates: Template[] | null = null
    let latestCompanies: Company[] | null = null
    const considerSeed = () => {
      if (!latestTemplates || !latestCompanies) return
      void seedIfEmpty(latestTemplates.length, latestCompanies.length).catch((err) => setError(firebaseMessage(err)))
    }
    const withPending = (list: Company[]) =>
      list.map((company) => {
        const pending = pendingValues.current.get(company.id)
        return pending ? { ...company, values: pending } : company
      })
    const unsubTemplates = onSnapshot(
      collection(db, TEMPLATES),
      (snap) => {
        latestTemplates = snap.docs
          .map((item) => asTemplate(item.id, item.data()))
          .filter((item): item is Template => item !== null)
        setTemplates(latestTemplates)
        setTemplatesReady(true)
        setError(null)
        considerSeed()
      },
      (err) => setError(firebaseMessage(err)),
    )
    const unsubCompanies = onSnapshot(
      collection(db, COMPANIES),
      (snap) => {
        latestCompanies = withPending(
          snap.docs
            .map((item) => asCompany(item.id, item.data()))
            .filter((item): item is Company => item !== null),
        )
        companiesRef.current = latestCompanies
        setCompanies(latestCompanies)
        setCompaniesReady(true)
        setError(null)
        considerSeed()
      },
      (err) => setError(firebaseMessage(err)),
    )
    return () => {
      unsubTemplates()
      unsubCompanies()
    }
  }, [])

  const selectedCompanyId = companies.some((company) => company.id === ui.selectedCompanyId)
    ? ui.selectedCompanyId
    : (companies[0]?.id ?? null)
  const activeTemplateId = templates.some((template) => template.id === ui.activeTemplateId)
    ? ui.activeTemplateId
    : (templates[0]?.id ?? null)

  useEffect(() => {
    if (!ready) return
    if (selectedCompanyId === ui.selectedCompanyId && activeTemplateId === ui.activeTemplateId) return
    setUi({ selectedCompanyId, activeTemplateId })
  }, [ready, selectedCompanyId, activeTemplateId, ui])

  const api = useMemo<Store>(() => {
    const fail = (err: unknown) => setError(firebaseMessage(err))
    return {
      ready,
      error,
      templates,
      companies,
      selectedCompanyId,
      activeTemplateId,
      setSelectedCompanyId: (id) => setUi({ selectedCompanyId: id, activeTemplateId }),
      setActiveTemplateId: (id) => setUi({ selectedCompanyId, activeTemplateId: id }),
      saveTemplate: (template) => {
        setUi({ selectedCompanyId, activeTemplateId: template.id })
        void setDoc(doc(db, TEMPLATES, template.id), template).catch(fail)
      },
      deleteTemplate: (id) => {
        void deleteDoc(doc(db, TEMPLATES, id)).catch(fail)
      },
      saveCompany: (company) => {
        if (!companies.some((item) => item.id === company.id)) {
          setUi({ selectedCompanyId: company.id, activeTemplateId })
        }
        void setDoc(doc(db, COMPANIES, company.id), company).catch(fail)
      },
      deleteCompany: (id) => {
        void (async () => {
          const messages = await getDocs(collection(db, COMPANIES, id, "messages"))
          const batch = writeBatch(db)
          messages.docs.forEach((item) => batch.delete(item.ref))
          batch.delete(doc(db, COMPANIES, id))
          await batch.commit()
        })().catch(fail)
      },
      setCompanyValue: (companyId, key, value) => {
        const company = companiesRef.current.find((item) => item.id === companyId)
        if (!company) return
        const values = { ...(pendingValues.current.get(companyId) ?? company.values), [key]: value }
        pendingValues.current.set(companyId, values)
        const next = companiesRef.current.map((item) => (item.id === companyId ? { ...item, values } : item))
        companiesRef.current = next
        setCompanies(next)
        const previous = writeTail.current.get(companyId) ?? Promise.resolve()
        const task = previous
          .catch(() => undefined)
          .then(async () => {
            if (pendingValues.current.get(companyId) !== values) return
            const current = companiesRef.current.find((item) => item.id === companyId)
            if (!current) return
            await setDoc(doc(db, COMPANIES, companyId), { ...current, values, updatedAt: Date.now() })
            if (pendingValues.current.get(companyId) === values) pendingValues.current.delete(companyId)
          })
        writeTail.current.set(companyId, task)
        void task.catch(fail)
      },
      importLibrary: (incoming) => {
        void (async () => {
          const batch = writeBatch(db)
          for (const template of incoming.templates) batch.set(doc(db, TEMPLATES, template.id), template)
          for (const company of incoming.companies) batch.set(doc(db, COMPANIES, company.id), company)
          await batch.commit()
        })().catch(fail)
      },
    }
  }, [ready, error, templates, companies, selectedCompanyId, activeTemplateId])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error("useStore must be used within StoreProvider")
  return store
}
