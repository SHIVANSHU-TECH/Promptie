"use client"

import { useEffect, useId, useRef, useState } from "react"

const steps = [
  {
    title: "Sign in",
    body: "Use Continue with Google. The library opens after that. Sign out from the header when you are done on a shared computer.",
  },
  {
    title: "Choose a company",
    body: "The company menu in the header is the brand you are filling prompts for. Add company when a brand is missing. Each company stores the values that replace slots, such as site id, domain, and product names.",
  },
  {
    title: "Write templates once",
    body: "Open Templates and add a prompt with a title, category, and body. Put anything that changes per brand in {{slots}}, for example {{site_id}}. Leave a slot empty and it stays visible as {{site_id}} so you can see what is still missing.",
  },
  {
    title: "Use one prompt for a project",
    body: "Pick the company in the header. On the Board, open one template. Empty slots stay as {{name}} until that company has a value. Copy for brand is the prompt filled for that project. To change the wording, open Chat, leave one prompt checked, and click Modify this prompt. Then Copy for the company, or Add to library and use it from the Board.",
  },
  {
    title: "Merge several prompts",
    body: "Open Chat and check two or more prompts. Click Merge selected prompts. Promptie returns one prompt with a title. Add to library, open that template on the Board, and copy it for the company. The merged prompt stays reusable because brand details remain in {{slots}}.",
  },
  {
    title: "Test a store",
    body: "Open Testing and paste a Lovable or live store link. The run opens two product pages, adds them to the cart, continues through checkout, and checks phone and desktop layout plus the legal pages. Coupon GLOBAL100 is used only when Stripe is live. Export the pass or fail report as Excel or PDF.",
  },
]

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
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 px-4 py-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-line bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">User manual</p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-ink">
                  How to use Promptie
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-rail hover:text-ink"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              Promptie stores prompts one time. You pick a company, fill the brand details, and copy a finished prompt.
              Modify one prompt for a project, or merge several prompts into one and use that result. Chat and Testing sit in the header.
            </p>
            <ol className="mt-5 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </>
  )
}
