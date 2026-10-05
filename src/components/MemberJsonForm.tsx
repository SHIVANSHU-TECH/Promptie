"use client"

import { useEffect, useState } from "react"
import { btnPrimary, field } from "@/lib/styles"

type Match = { siteId: string; name: string; widgetId: string; active: boolean }

export function MemberJsonForm() {
  const [name, setName] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [domain, setDomain] = useState("")
  const [siteId, setSiteId] = useState("")
  const [widgetId, setWidgetId] = useState("")
  const [logo, setLogo] = useState("")
  const [favicon, setFavicon] = useState("")
  const [sheetNote, setSheetNote] = useState("")
  const [json, setJson] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.title = "Member JSON · Promptie"
  }, [])

  useEffect(() => {
    const query = name.trim()
    if (query.length < 2) return
    const timer = window.setTimeout(() => {
      void fetch(`/api/sheet?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((payload: { matches?: Match[]; error?: string }) => {
          if (payload.error) {
            setSheetNote(payload.error)
            return
          }
          const exact = payload.matches?.filter((item) => item.name.toLowerCase() === query.toLowerCase()) ?? []
          const match = exact.length === 1 ? exact[0] : payload.matches?.length === 1 ? payload.matches[0] : null
          if (!match) {
            setSheetNote(payload.matches && payload.matches.length > 1 ? "More than one sheet row matches. Pick the site id yourself, or leave it empty." : "")
            return
          }
          setSiteId((current) => current || match.siteId)
          setWidgetId((current) => current || match.widgetId)
          setSheetNote(`${match.name} is site id ${match.siteId}${match.widgetId ? `, widget ${match.widgetId}` : ""}.`)
        })
        .catch(() => setSheetNote(""))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [name])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function build() {
    setPending(true)
    setError("")
    setNote("")
    try {
      const response = await fetch("/api/member-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, websiteUrl, domain, siteId, widgetId, logo, favicon }),
      })
      const payload = (await response.json()) as { json?: string; note?: string; error?: string }
      if (!response.ok || !payload.json) throw new Error(payload.error || "The member JSON could not be built.")
      setJson(payload.json)
      setNote(payload.note || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "The member JSON could not be built.")
    } finally {
      setPending(false)
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      const area = document.createElement("textarea")
      area.value = json
      document.body.appendChild(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
    setCopied(true)
  }

  return (
    <div className="h-full overflow-auto bg-paper">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          className="space-y-4 rounded-lg border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void build()
          }}
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Member JSON</h1>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-muted">
              <li>1. Name the project and paste its live or Lovable link.</li>
              <li>2. Site id and chat widget fill from the checkout sheet when that name is listed. Edit either one, or leave it empty.</li>
              <li>3. Colors are read from the link. Paste Drive links for the logo and favicon when you have them.</li>
            </ol>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Project</span>
            <input className={field} value={name} onChange={(event) => setName(event.target.value)} placeholder="Kove RX" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Live or Lovable link</span>
            <input className={field} value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://koverx.com" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Member domain</span>
            <input className={field} value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="member.koverx.com" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Site id</span>
              <input className={field} value={siteId} onChange={(event) => setSiteId(event.target.value)} placeholder="From the sheet, or empty" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Chat widget</span>
              <input className={field} value={widgetId} onChange={(event) => setWidgetId(event.target.value)} placeholder="From the sheet, or empty" />
            </label>
          </div>
          {sheetNote ? <p className="text-sm leading-6 text-muted">{sheetNote}</p> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Logo Drive link</span>
            <input className={field} value={logo} onChange={(event) => setLogo(event.target.value)} placeholder="https://drive.google.com/file/d/…" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Favicon Drive link</span>
            <input className={field} value={favicon} onChange={(event) => setFavicon(event.target.value)} placeholder="https://drive.google.com/file/d/…" />
          </label>
          {error ? <p className="text-sm text-warn">{error}</p> : null}
          <button type="submit" className={btnPrimary} disabled={pending || !name.trim() || !websiteUrl.trim()}>
            {pending ? "Building…" : "Build JSON"}
          </button>
        </form>
        <section className="min-w-0 rounded-lg bg-prompt text-prompt-text">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <p className="text-sm font-medium">member.json</p>
            <button
              type="button"
              className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
              disabled={!json}
              onClick={() => void copyJson()}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {note ? <p className="border-b border-white/10 px-4 py-3 text-xs leading-5 text-white/70">{note}</p> : null}
          <pre className="max-h-[40rem] overflow-auto px-4 py-4 font-mono text-xs leading-5 whitespace-pre-wrap">
            {json || "The JSON appears here."}
          </pre>
        </section>
      </div>
    </div>
  )
}
