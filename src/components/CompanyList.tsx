"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { btnPrimary, btnQuiet } from "@/lib/styles"
import { useStore } from "@/lib/store"
import { ConfirmButton } from "./ConfirmButton"

function edited(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function CompanyList() {
  const router = useRouter()
  const { ready, companies, setSelectedCompanyId, deleteCompany } = useStore()

  useEffect(() => {
    document.title = "Companies · Promptie"
  }, [])

  if (!ready) return <div className="h-full bg-paper" />

  const ordered = [...companies].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="h-full overflow-auto bg-paper">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              A company holds the brand, project, and any other values that change from one job to the next.
            </p>
          </div>
          <Link href="/companies/new" className={btnPrimary}>
            New company
          </Link>
        </div>

        {ordered.length === 0 ? (
          <p className="mt-10 text-sm text-muted">No companies yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-card">
            {ordered.map((company) => {
              const filled = Object.values(company.values).filter((value) => value.trim()).length
              return (
                <li key={company.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{company.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {filled} parameters · edited {edited(company.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnQuiet}
                    onClick={() => {
                      setSelectedCompanyId(company.id)
                      router.push("/")
                    }}
                  >
                    Use
                  </button>
                  <Link href={`/companies/${company.id}`} className={btnQuiet}>
                    Edit
                  </Link>
                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Confirm"
                    className={btnQuiet}
                    onConfirm={() => deleteCompany(company.id)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
