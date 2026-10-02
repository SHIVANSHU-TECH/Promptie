"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createId, extractSlots, isSlotKey } from "@/lib/prompt"
import { btnDanger, btnGhost, btnPrimary, field } from "@/lib/styles"
import { useStore } from "@/lib/store"
import { ConfirmButton } from "./ConfirmButton"

type Row = { uid: string; key: string; value: string }

function toRows(values: Record<string, string>): Row[] {
  const rows = Object.entries(values).map(([key, value]) => ({
    uid: createId("row"),
    key,
    value,
  }))
  return rows.length > 0 ? rows : [{ uid: createId("row"), key: "", value: "" }]
}

const starterRows = ["brand_name", "project_name", "product_summary", "stack"]

export function CompanyForm({ companyId }: { companyId: string }) {
  const { ready } = useStore()
  if (!ready) return <div className="h-full bg-paper" />
  return <CompanyEditor companyId={companyId} />
}

function CompanyEditor({ companyId }: { companyId: string }) {
  const router = useRouter()
  const { templates, companies, saveCompany, deleteCompany, setSelectedCompanyId } = useStore()
  const isNew = companyId === "new"
  const existing = companies.find((company) => company.id === companyId)
  const [name, setName] = useState(existing?.name ?? "")
  const [rows, setRows] = useState<Row[]>(() =>
    existing ? toRows(existing.values) : starterRows.map((key) => ({ uid: createId("row"), key, value: "" })),
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = isNew ? "New company · Promptie" : "Edit company · Promptie"
  }, [isNew])

  const used = new Set(rows.map((row) => row.key.trim()).filter(Boolean))
  const suggestions = [...new Set(templates.flatMap((template) => extractSlots(template.body)))]
    .filter((slot) => !used.has(slot))
    .sort()

  function save() {
    const nextName = name.trim()
    if (!nextName) {
      setError("Add a company name.")
      return
    }
    const keys = rows.map((row) => row.key.trim()).filter(Boolean)
    const duplicate = keys.find((key, index) => keys.indexOf(key) !== index)
    if (duplicate) {
      setError(`Two parameters use the key ${duplicate}.`)
      return
    }
    const invalid = keys.find((key) => !isSlotKey(key))
    if (invalid) {
      setError(`${invalid} is not a valid slot name. Use letters, numbers, and underscores.`)
      return
    }
    const values: Record<string, string> = {}
    for (const row of rows) {
      const key = row.key.trim()
      if (!key) continue
      values[key] = row.value
    }
    const id = isNew ? createId("co") : companyId
    saveCompany({ id, name: nextName, values, updatedAt: Date.now() })
    setSelectedCompanyId(id)
    setError(null)
    setNotice("Saved.")
    if (isNew) router.replace(`/companies/${id}`)
  }

  if (!isNew && !existing) {
    return (
      <div className="h-full overflow-auto bg-paper">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-sm text-muted">This company is not in the library.</p>
          <Link href="/companies" className="mt-4 inline-block text-sm text-accent underline">
            Back to companies
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
            <Link href="/companies" className="text-sm text-muted underline">
              Companies
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {isNew ? "New company" : "Edit company"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              These values fill every template that uses the same slot.
            </p>
          </div>
          <button type="submit" className={btnPrimary}>
            Save company
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <div>
          <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-2 px-1 text-xs text-muted sm:grid">
            <span>Slot</span>
            <span>Value</span>
            <span className="sr-only">Remove</span>
          </div>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.uid} className="grid gap-2 rounded-md border border-line bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
                <input
                  className={`${field} font-mono`}
                  value={row.key}
                  aria-label="Slot"
                  autoComplete="off"
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) => (item.uid === row.uid ? { ...item, key: event.target.value } : item)),
                    )
                  }
                />
                <input
                  className={field}
                  value={row.value}
                  aria-label="Value"
                  autoComplete="off"
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) => (item.uid === row.uid ? { ...item, value: event.target.value } : item)),
                    )
                  }
                />
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setRows((current) => current.filter((item) => item.uid !== row.uid))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${btnGhost} mt-3`}
            onClick={() => setRows((current) => [...current, { uid: createId("row"), key: "", value: "" }])}
          >
            Add parameter
          </button>
        </div>

        {suggestions.length > 0 ? (
          <div>
            <p className="text-sm text-muted">Slots used in templates and missing here</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="rounded-full border border-line bg-card px-2 py-1 font-mono text-xs text-ink hover:bg-accent-soft"
                  onClick={() =>
                    setRows((current) => [...current, { uid: createId("row"), key: slot, value: "" }])
                  }
                >
                  {`{{${slot}}}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-warn">{error}</p> : null}
        {notice ? <p className="text-sm text-accent">{notice}</p> : null}

        {!isNew ? (
          <div>
            <ConfirmButton
              label="Delete company"
              confirmLabel="Delete this company"
              className={btnDanger}
              onConfirm={() => {
                deleteCompany(companyId)
                router.push("/companies")
              }}
            />
          </div>
        ) : null}
      </form>
    </div>
  )
}
