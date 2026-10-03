"use client"

import { useState } from "react"
import type { FlowReport } from "@/lib/flow-report"
import { reportPassed } from "@/lib/flow-report"
import { btnGhost, btnPrimary, field } from "@/lib/styles"

export function FlowTest() {
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<FlowReport | null>(null)

  async function runTest() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/flow-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const payload = (await response.json()) as FlowReport & { error?: string }
      if (!response.ok) throw new Error(payload.error || "The flow test could not finish.")
      setReport(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The flow test could not finish.")
    } finally {
      setPending(false)
    }
  }

  async function download(format: "xls" | "pdf") {
    if (!report) return
    const response = await fetch("/api/flow-test/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, report }),
    })
    if (!response.ok) return
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = href
    link.download = format === "pdf" ? "promptie-flow-test.pdf" : "promptie-flow-test.xls"
    link.click()
    URL.revokeObjectURL(href)
  }

  const passed = report ? report.checks.filter((item) => item.status === "pass").length : 0

  return (
    <div className="h-full overflow-auto bg-paper">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Automation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Flow testing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Paste a Lovable or live store link. The run follows the store path: two product pages, Add to Cart, the cart,
          then checkout. It fills contact, shipping, HIPAA, and telehealth consent, and checks phone and desktop layout
          on each of those pages plus the legal footer. Coupon GLOBAL100 is used only when Stripe is live. A Stripe test
          key skips the coupon.
        </p>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            void runTest()
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Store link</span>
            <input
              className={field}
              value={url}
              placeholder="https://your-store.lovable.app"
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <button type="submit" className={btnPrimary} disabled={pending || url.trim().length === 0}>
            {pending ? "Running…" : "Run test"}
          </button>
        </form>
        {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
        {report ? (
          <section className="mt-8 overflow-hidden rounded-lg border border-line bg-card">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-ink px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-semibold">P</span>
                <div>
                  <p className="text-sm font-semibold">Promptie flow report</p>
                  <p className="text-xs text-white/70">
                    {passed} of {report.checks.length} passed
                    {reportPassed(report) ? " · overall pass" : " · overall fail"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-md bg-white px-3 py-2 text-sm font-medium text-ink" onClick={() => void download("xls")}>
                  Export Excel
                </button>
                <button type="button" className={`${btnGhost} border-white/20 bg-transparent text-white hover:bg-white/10`} onClick={() => void download("pdf")}>
                  Export PDF
                </button>
              </div>
            </div>
            <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs tracking-wide text-muted uppercase">Order id</dt>
                <dd className="mt-1 font-medium">{report.orderId || "Not created"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-muted uppercase">Mail id</dt>
                <dd className="mt-1 font-medium">{report.email || "Not entered"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-muted uppercase">Stripe</dt>
                <dd className="mt-1 font-medium">{report.stripeMode}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-muted uppercase">Coupon</dt>
                <dd className="mt-1 font-medium">{report.couponUsed ? report.couponCode : "Not used"}</dd>
              </div>
            </dl>
            <table className="w-full text-left text-sm">
              <thead className="bg-rail text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Check</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={item.status === "pass" ? "text-accent" : "text-warn"}>
                        {item.status === "pass" ? "Pass" : "Fail"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </div>
  )
}
