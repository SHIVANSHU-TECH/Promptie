"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { createId, extractSlots, fillPrompt, groupTemplates, openSlots } from "@/lib/prompt"
import { btnPrimary, field } from "@/lib/styles"
import { useStore } from "@/lib/store"
import { PromptView } from "./PromptView"
import { SlotEditor } from "./SlotEditor"

export function Board() {
  const {
    ready,
    templates,
    companies,
    selectedCompanyId,
    activeTemplateId,
    setActiveTemplateId,
    setSelectedCompanyId,
    saveCompany,
    setCompanyValue,
  } = useStore()
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [narrowDetail, setNarrowDetail] = useState(false)

  useEffect(() => {
    document.title = "Board · Promptie"
  }, [])

  const company = companies.find((item) => item.id === selectedCompanyId) ?? null
  const values = company ? company.values : draft
  const needle = query.trim().toLowerCase()
  const visible = templates.filter((template) => {
    if (!needle) return true
    return [template.title, template.category, template.description, template.body]
      .join("\n")
      .toLowerCase()
      .includes(needle)
  })
  const groups = groupTemplates(visible)
  const active = templates.find((template) => template.id === activeTemplateId) ?? visible[0] ?? null
  const slots = useMemo(() => (active ? extractSlots(active.body) : []), [active])
  const missing = active ? openSlots(active.body, values) : []
  const filled = active ? fillPrompt(active.body, values) : ""

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyPrompt() {
    if (!filled) return
    try {
      await navigator.clipboard.writeText(filled)
    } catch {
      const area = document.createElement("textarea")
      area.value = filled
      document.body.appendChild(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
    setCopied(true)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault()
        void copyPrompt()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // copyPrompt closes over the latest filled prompt via render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled])

  function onSlotChange(key: string, value: string) {
    if (company) setCompanyValue(company.id, key, value)
    else setDraft((current) => ({ ...current, [key]: value }))
  }

  function saveDraftAsCompany() {
    const name = draft.brand_name?.trim() || draft.project_name?.trim() || "New company"
    const id = createId("co")
    const kept = Object.fromEntries(Object.entries(draft).filter(([, value]) => value.trim()))
    saveCompany({ id, name, values: kept, updatedAt: Date.now() })
    setSelectedCompanyId(id)
    setDraft({})
  }

  if (!ready) {
    return <div className="h-full bg-paper" />
  }

  return (
    <div className="flex h-full min-h-0 bg-paper">
      <aside
        className={`${narrowDetail ? "hidden" : "flex"} w-full min-h-0 shrink-0 flex-col border-r border-line bg-rail lg:flex lg:w-80`}
      >
        <div className="border-b border-line p-4">
          <h1 className="text-sm font-semibold">Prompts</h1>
          <p className="mt-1 text-xs text-muted">
            {company ? `Filled with ${company.name}` : "No company selected"}
          </p>
          <input
            className={`${field} mt-3`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompts"
            aria-label="Search prompts"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {templates.length === 0 ? (
            <div className="px-2 py-6 text-sm leading-6 text-muted">
              No templates yet.{" "}
              <Link href="/templates/new" className="text-accent underline">
                Write the first one
              </Link>
              .
            </div>
          ) : null}
          {templates.length > 0 && groups.length === 0 ? (
            <div className="px-2 py-6 text-sm text-muted">
              Nothing matches that search.{" "}
              <button type="button" className="text-accent underline" onClick={() => setQuery("")}>
                Clear
              </button>
            </div>
          ) : null}
          <div className="space-y-5">
            {groups.map(([category, items]) => (
              <section key={category}>
                <h2 className="px-2 text-xs font-medium tracking-wide text-muted uppercase">{category}</h2>
                <ul className="mt-2 space-y-1">
                  {items.map((template) => {
                    const open = openSlots(template.body, values).length
                    const selected = template.id === active?.id
                    return (
                      <li key={template.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTemplateId(template.id)
                            setNarrowDetail(true)
                          }}
                          className={`w-full rounded-md border-l-2 px-3 py-2.5 text-left ${
                            selected
                              ? "border-l-accent bg-accent-soft"
                              : "border-l-transparent hover:bg-card"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium">{template.title}</span>
                            <span className={`shrink-0 text-xs ${open === 0 ? "text-accent" : "text-warn"}`}>
                              {open === 0 ? "Ready" : `${open} open`}
                            </span>
                          </span>
                          {template.description ? (
                            <span className="mt-1 block text-xs leading-5 text-muted">{template.description}</span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </aside>

      <section className={`${narrowDetail ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col lg:flex`}>
        {active ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
                <div>
                  <button
                    type="button"
                    className="mb-3 text-sm text-muted underline lg:hidden"
                    onClick={() => setNarrowDetail(false)}
                  >
                    All prompts
                  </button>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">{active.title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {company ? (
                          <>
                            for <span className="font-medium text-ink">{company.name}</span>
                          </>
                        ) : (
                          "No company yet. These values are kept until you save them."
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/templates/${active.id}`}
                      className="text-sm text-accent underline decoration-accent/40 underline-offset-2"
                    >
                      Edit template
                    </Link>
                  </div>
                  {active.description ? (
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{active.description}</p>
                  ) : null}
                  {!company ? (
                    <button type="button" className={`${btnPrimary} mt-4`} onClick={saveDraftAsCompany}>
                      Save as company
                    </button>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      Editing a value here saves it on {company.name}, so every template that uses the same slot picks it up.
                    </p>
                  )}
                </div>

                <SlotEditor slots={slots} values={values} onChange={onSlotChange} />

                <div className="overflow-hidden rounded-lg bg-prompt">
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <p className="text-sm text-white/70">Prompt</p>
                    {missing.length > 0 ? (
                      <button
                        type="button"
                        className="text-sm text-slot-empty"
                        onClick={() => document.getElementById(`slot-${missing[0]}`)?.focus()}
                      >
                        {missing.length} still open
                      </button>
                    ) : (
                      <p className="text-sm text-slot-fill">Ready to copy</p>
                    )}
                  </div>
                  <div className="px-5 py-5">
                    <PromptView body={active.body} values={values} />
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-line bg-paper">
              <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-3">
                <p className="text-sm text-muted" aria-live="polite">
                  {copied
                    ? "Copied."
                    : missing.length > 0
                      ? "Empty slots stay as {{name}} in the copied prompt."
                      : "Ctrl+Enter copies the prompt."}
                </p>
                <button type="button" className={btnPrimary} onClick={() => void copyPrompt()}>
                  {copied ? "Copied" : "Copy prompt"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted">
            {templates.length === 0 ? "Create a template to start." : "Choose a prompt."}
          </div>
        )}
      </section>
    </div>
  )
}
