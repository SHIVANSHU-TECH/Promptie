"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { LibraryMenu } from "./LibraryMenu"

const links = [
  { href: "/", label: "Board" },
  { href: "/templates", label: "Templates" },
  { href: "/companies", label: "Companies" },
  { href: "/chat", label: "Chat" },
]

function isCurrent(href: string, path: string) {
  if (href === "/") return path === "/"
  return path === href || path.startsWith(`${href}/`)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { ready, error, companies, selectedCompanyId, setSelectedCompanyId } = useStore()
  const ordered = [...companies].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-white/10 bg-ink text-white">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm">P</span>
            Promptie
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((link) => {
              const current = isCurrent(link.href, path)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-md px-2.5 py-1.5 ${
                    current ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LibraryMenu />
            <label className="flex items-center gap-2 text-sm text-white/70">
              <span className="hidden sm:inline">Company</span>
              <select
                aria-label="Company"
                className="max-w-[14rem] rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40 disabled:opacity-50"
                disabled={!ready || ordered.length === 0}
                value={selectedCompanyId ?? ""}
                onChange={(event) => setSelectedCompanyId(event.target.value || null)}
              >
                {ordered.length === 0 ? <option value="">No company</option> : null}
                {ordered.map((company) => (
                  <option key={company.id} value={company.id} className="text-ink">
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href="/companies/new"
              aria-label="Add company"
              className="rounded-md px-2 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              Add company
            </Link>
          </div>
        </div>
      </header>
      {error ? <p className="shrink-0 bg-warn-soft px-4 py-2 text-sm text-warn">{error}</p> : null}
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
