"use client"

import { useEffect, useRef, useState } from "react"
import type { FlowReport } from "@/lib/flow-report"
import { reportPassed } from "@/lib/flow-report"
import { btnGhost, btnPrimary, field } from "@/lib/styles"

export function FlowTest() {
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<FlowReport | null>(null)
  const [phoneFrame, setPhoneFrame] = useState("")
  const [laptopFrame, setLaptopFrame] = useState("")
  const [step, setStep] = useState("")
  const [device, setDevice] = useState<"phone" | "laptop">("phone")
  const [full, setFull] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === stageRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  async function toggleFull() {
    const stage = stageRef.current
    if (!stage) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stage.requestFullscreen()
    } catch {
      /* the browser blocked full screen */
    }
  }

  async function runTest() {
    setPending(true)
    setError(null)
    setReport(null)
    setPhoneFrame("")
    setLaptopFrame("")
    setStep("Starting the browser")
    try {
      const response = await fetch("/api/flow-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const type = response.headers.get("content-type") || ""
      if (type.includes("application/json")) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error || "The flow test could not finish.")
      }
      if (!response.ok || !response.body) throw new Error("The flow test could not finish.")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let receivedReport = false
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as {
            type?: string
            image?: string
            phone?: string
            laptop?: string
            label?: string
            error?: string
            report?: FlowReport
          }
          if (event.type === "frame") {
            const phoneShot = event.phone || event.image || ""
            const laptopShot = event.laptop || event.image || ""
            if (phoneShot) setPhoneFrame(`data:image/jpeg;base64,${phoneShot}`)
            if (laptopShot) setLaptopFrame(`data:image/jpeg;base64,${laptopShot}`)
            if (event.label) setStep(event.label)
          } else if (event.type === "report" && event.report) {
            receivedReport = true
            setReport(event.report)
            setStep(event.report.orderId ? `Order ${event.report.orderId}` : "Finished")
          } else if (event.type === "error") {
            throw new Error(event.error || "The flow test could not finish.")
          }
        }
      }
      if (!receivedReport) throw new Error("The flow test stopped before the report.")
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
          The run opens a temporary inbox, adds two treatments, checks out with that address, then reads the order
          mail and the member login mail. It signs in, sets a new password, confirms the orders, and submits the
          medical intake for every product. An order has to be created before the member login can work.
        </p>
        <ol className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-muted">
          {["Home", "Product", "Cart", "Checkout", "Mail", "Portal", "Intake"].map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-accent">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <form
          className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault()
            void runTest()
          }}
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">Store link</span>
            <input
              className={field}
              value={url}
              placeholder="https://koverx.com"
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs leading-5 text-muted">
              Coupon GLOBAL100 is used only when Stripe is live. The report includes the temporary member id and the
              password that was set on the portal.
            </p>
            <button type="submit" className={btnPrimary} disabled={pending || url.trim().length === 0}>
              {pending ? "Running…" : "Run test"}
            </button>
          </div>
        </form>
        <div
          ref={stageRef}
          className={`mt-6 flex flex-col items-center ${full ? "h-full justify-center bg-paper px-6" : ""}`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <div className="flex rounded-md border border-line bg-card p-0.5">
              {(["phone", "laptop"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={device === option}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${device === option ? "bg-accent text-white" : "text-ink hover:bg-rail"}`}
                  onClick={() => setDevice(option)}
                >
                  {option === "phone" ? "Phone" : "Laptop"}
                </button>
              ))}
            </div>
            <button type="button" className={btnGhost} onClick={() => void toggleFull()}>
              {full ? "Exit full screen" : "Full screen"}
            </button>
          </div>
          <WatchFrame device={device} full={full} frame={device === "phone" ? phoneFrame : laptopFrame} pending={pending} />
          <p className="mt-3 text-center text-xs font-medium tracking-wide text-muted uppercase">
            {step || "Watch the checkout"}
          </p>
        </div>
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
                <dt className="text-xs tracking-wide text-muted uppercase">Member id</dt>
                <dd className="mt-1 font-medium">{report.email || "Not created"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-muted uppercase">Password set</dt>
                <dd className="mt-1 font-medium">{report.memberPassword || "Not set"}</dd>
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

function WatchFrame({
  device,
  full,
  frame,
  pending,
}: {
  device: "phone" | "laptop"
  full: boolean
  frame: string
  pending: boolean
}) {
  const picture = frame ? (
    // The frame is a live JPEG from the checkout browser.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={frame} alt="" className="h-full w-full object-cover object-top" />
  ) : (
    <div className="grid h-full place-items-center px-4 text-center text-xs leading-5 text-muted">
      {pending ? "Opening the store…" : "The view appears here while the test runs."}
    </div>
  )

  if (device === "phone") {
    return (
      <div className={full ? "h-[min(88vh,820px)]" : "w-[220px]"}>
        <div className="h-full rounded-[1.7rem] bg-ink p-2 shadow-[0_18px_40px_rgba(20,36,30,0.18)]">
          <div className={`overflow-hidden rounded-[1.3rem] bg-[#f6f1e6] ${full ? "mx-auto aspect-[390/844] h-full" : "aspect-[390/844]"}`}>
            {picture}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={full ? "w-[min(96vw,1200px)]" : "w-full max-w-[640px]"}>
      <div className="rounded-xl bg-ink p-2 shadow-[0_18px_40px_rgba(20,36,30,0.18)]">
        <div className={`overflow-hidden rounded-md bg-[#f6f1e6] ${full ? "aspect-[16/10] max-h-[78vh]" : "aspect-[16/10]"}`}>
          {picture}
        </div>
      </div>
      <div className="mx-auto h-2 w-28 rounded-b-md bg-ink/70" />
      <div className="mx-auto h-1.5 w-44 rounded-b-lg bg-ink" />
    </div>
  )
}
