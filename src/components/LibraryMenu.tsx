"use client"

import { useRef, useState } from "react"
import { parseDatabase } from "@/lib/storage"
import { useStore } from "@/lib/store"
import { btnGhost } from "@/lib/styles"

export function LibraryMenu() {
  const { templates, companies, selectedCompanyId, activeTemplateId, importLibrary } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  function exportLibrary() {
    const payload = {
      version: 1 as const,
      templates,
      companies,
      selectedCompanyId,
      activeTemplateId,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "promptie-library.json"
    link.click()
    URL.revokeObjectURL(url)
    setMessage("Exported promptie-library.json")
  }

  function onImport(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseDatabase(JSON.parse(String(reader.result)))
        if (!parsed) {
          setMessage("That file is not a Promptie library.")
          return
        }
        importLibrary(parsed)
        setMessage(`Merged ${parsed.templates.length} templates and ${parsed.companies.length} companies.`)
      } catch {
        setMessage("That file is not a Promptie library.")
      }
    }
    reader.readAsText(file)
  }

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-2.5 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        Library
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-line bg-card p-3 text-ink shadow-none">
        <p className="text-sm leading-5 text-muted">
          Templates and companies stay in this browser. Export a copy if you want a backup.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" className={btnGhost} onClick={exportLibrary}>
            Export
          </button>
          <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
            Import and merge
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) onImport(file)
          }}
        />
        {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
      </div>
    </details>
  )
}
