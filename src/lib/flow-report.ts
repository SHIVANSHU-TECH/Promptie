export type CheckStatus = "pass" | "fail"

export type FlowCheck = {
  id: string
  name: string
  status: CheckStatus
  detail: string
}

export type FlowReport = {
  url: string
  startedAt: string
  finishedAt: string
  stripeMode: "live" | "test" | "unknown"
  couponUsed: boolean
  couponCode: string
  orderId: string
  email: string
  checks: FlowCheck[]
}

export function reportPassed(report: FlowReport) {
  return report.checks.length > 0 && report.checks.every((check) => check.status === "pass")
}
