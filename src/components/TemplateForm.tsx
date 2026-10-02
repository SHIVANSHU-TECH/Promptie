"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createId, extractSlots, isSlotKey } from "@/lib/prompt"
import { btnDanger, btnGhost, btnPrimary, field } from "@/lib/styles"
import { useStore } from "@/lib/store"
import { ConfirmButton } from "./ConfirmButton"
import { PromptView } from "./PromptView"

const starter = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Product context:
{{product_summary}}

Stack: {{stack}}

Task:

Requirements:
- `

export function TemplateForm({ templateId }: { templateId: string }) {
  const { ready } = useStore()
  if (!ready) return <div className="h-full bg-paper" />
  return <TemplateEditor templateId={templateId} />
}

function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter()
  const { templates, companies, selectedCompanyId, saveTemplate, deleteTemplate } = useStore()
  const isNew = templateId === "new"
  const existing = templates.find((template) => template.id === templateId)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState(existing?.title ?? "")
  const [category, setCategory] = useState(existing?.category || "General")
  const [description, setDescription] = useState(existing?.description ?? "")
  const [body, setBody] = useState(existing?.body ?? starter)
  const [slotName, setSlotName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = isNew ? "New template · Promptie" : "Edit template · Promptie"
  }, [isNew])

  const slots = extractSlots(body)
  const categories = [...new Set(templates.map((template) => template.category).filter(Boolean))]
  const company = companies.find((item) => item.id === selectedCompanyId) ?? null

  function insertSlot() {
    const key = slotName.trim()
    if (!isSlotKey(key)) {
      setError("Slot names start with a letter and use letters, numbers, and underscores.")
      return
    }
    const token = `{{${key}}}`
    const area = bodyRef.current
    if (!area) {
      setBody((current) => `${current}${token}`)
    } else {
      const start = area.selectionStart
      const end = area.selectionEnd
      const next = body.slice(0, start) + token + body.slice(end)
      setBody(next)
      requestAnimationFrame(() => {
        area.focus()
        const pos = start + token.length
        area.setSelectionRange(pos, pos)
      })
    }
    setSlotName("")
    setError(null)
  }

  function save() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError("Add a title.")
      return
    }
    if (!body.trim()) {
      setError("Write the prompt.")
      return
    }
    const id = isNew ? createId("tpl") : templateId
    saveTemplate({
      id,
      title: nextTitle,
      category: category.trim() || "General",
      description: description.trim(),
      body,
      updatedAt: Date.now(),
    })
    setError(null)
    setNotice("Saved.")
    if (isNew) router.replace(`/templates/${id}`)
  }

  function duplicate() {
    const nextTitle = title.trim()
    if (!nextTitle || !body.trim()) {
      setError("Add a title and a prompt before duplicating.")
      return
    }
    const id = createId("tpl")
    saveTemplate({
      id,
      title: `${nextTitle} copy`,
      category: category.trim() || "General",
      description: description.trim(),
      body,
      updatedAt: Date.now(),
    })
    router.push(`/templates/${id}`)
  }

  if (!isNew && !existing) {
    return (
      <div className="h-full overflow-auto bg-paper">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-sm text-muted">This template is not in the library.</p>
          <Link href="/templates" className="mt-4 inline-block text-sm text-accent underline">
            Back to templates
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-paper">
      <form
        className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/templates" className="text-sm text-muted underline">
              Templates
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {isNew ? "New template" : "Edit template"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNew ? (
              <button type="button" className={btnGhost} onClick={duplicate}>
                Duplicate
              </button>
            ) : null}
            <button type="submit" className={btnPrimary}>
              Save template
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Title</span>
          <input className={field} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Category</span>
            <input
              className={field}
              value={category}
              list="promptie-categories"
              onChange={(event) => setCategory(event.target.value)}
            />
            <datalist id="promptie-categories">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Description</span>
            <input
              className={field}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this prompt is for"
            />
          </label>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Prompt</span>
            <span className="text-xs text-muted">Slots look like {"{{brand_name}}"}</span>
          </div>
          <textarea
            ref={bodyRef}
            className={`${field} min-h-80 font-mono leading-6`}
            value={body}
            spellCheck
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className={`${field} max-w-xs font-mono`}
              value={slotName}
              placeholder="slot_name"
              aria-label="Slot name"
              autoComplete="off"
              onChange={(event) => setSlotName(event.target.value)}
            />
            <button type="button" className={btnGhost} onClick={insertSlot}>
              Insert slot
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map((slot) => (
              <span key={slot} className="rounded-full bg-accent-soft px-2 py-1 font-mono text-xs text-accent-strong">
                {`{{${slot}}}`}
              </span>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-warn">{error}</p> : null}
        {notice ? <p className="text-sm text-accent">{notice}</p> : null}

        <div className="overflow-hidden rounded-lg bg-prompt">
          <p className="border-b border-white/10 px-4 py-3 text-sm text-white/70">
            Preview{company ? ` with ${company.name}` : ""}
          </p>
          <div className="px-5 py-5">
            <PromptView body={body} values={company?.values ?? {}} />
          </div>
        </div>

        {!isNew ? (
          <div>
            <ConfirmButton
              label="Delete template"
              confirmLabel="Delete this template"
              className={btnDanger}
              onConfirm={() => {
                deleteTemplate(templateId)
                router.push("/templates")
              }}
            />
          </div>
        ) : null}
      </form>
    </div>
  )
}
