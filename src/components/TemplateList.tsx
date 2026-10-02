"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { extractSlots } from "@/lib/prompt"
import { btnPrimary, btnQuiet } from "@/lib/styles"
import { useStore } from "@/lib/store"
import { ConfirmButton } from "./ConfirmButton"

function edited(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function TemplateList() {
  const router = useRouter()
  const { ready, templates, setActiveTemplateId, deleteTemplate } = useStore()

  useEffect(() => {
    document.title = "Templates · Promptie"
  }, [])

  if (!ready) return <div className="h-full bg-paper" />

  const groups = new Map<string, typeof templates>()
  for (const template of [...templates].sort((a, b) => a.title.localeCompare(b.title))) {
    const category = template.category || "General"
    const list = groups.get(category) ?? []
    list.push(template)
    groups.set(category, list)
  }

  return (
    <div className="h-full overflow-auto bg-paper">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Write a prompt once. Mark anything that changes between companies as a slot, like {"{{brand_name}}"}.
            </p>
          </div>
          <Link href="/templates/new" className={btnPrimary}>
            New template
          </Link>
        </div>

        {templates.length === 0 ? (
          <p className="mt-10 text-sm text-muted">No templates yet.</p>
        ) : (
          <div className="mt-8 space-y-8">
            {[...groups.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([category, items]) => (
                <section key={category}>
                  <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{category}</h2>
                  <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
                    {items.map((template) => (
                      <li key={template.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{template.title}</p>
                          <p className="mt-1 text-xs text-muted">
                            {extractSlots(template.body).length} slots · edited {edited(template.updatedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={btnQuiet}
                          onClick={() => {
                            setActiveTemplateId(template.id)
                            router.push("/")
                          }}
                        >
                          Use
                        </button>
                        <Link href={`/templates/${template.id}`} className={btnQuiet}>
                          Edit
                        </Link>
                        <ConfirmButton
                          label="Delete"
                          confirmLabel="Confirm"
                          className={btnQuiet}
                          onConfirm={() => deleteTemplate(template.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
