"use client"

import { useEffect, useId, useRef, useState } from "react"
import { GuideStory } from "./GuideStory"

export function UserGuide({ tone = "header" }: { tone?: "header" | "card" }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const buttonClass =
    tone === "header"
      ? "rounded-md border border-white/20 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/10"
      : "text-sm font-medium text-accent hover:text-accent-strong"

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        How to use
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/55 px-3 py-3 sm:place-items-center sm:px-6 sm:py-8" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[0_30px_80px_rgba(20,36,30,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">User manual</p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-ink">
                  How the flow works
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                  The story covers the whole product. First the store path, including the temporary inbox, member login, new password, orders, and intake. Then Promptie itself: sign in, add a company, modify one prompt, merge prompts, ask the sheet, build a member JSON, and run Testing.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="rounded-full border border-line px-3 py-1.5 text-sm text-ink hover:bg-rail"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
              <GuideStory />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
