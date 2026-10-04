import { NextResponse } from "next/server"
import { runFlowTest } from "@/lib/flow-test"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  let url = ""
  let email = ""
  try {
    const body = (await request.json()) as { url?: unknown; email?: unknown }
    url = typeof body.url === "string" ? body.url : ""
    email = typeof body.email === "string" ? body.email : ""
  } catch {
    return NextResponse.json({ error: "Send the store link as JSON." }, { status: 400 })
  }
  if (!url.trim()) return NextResponse.json({ error: "Enter the Lovable or live link." }, { status: 400 })
  if (!email.trim()) return NextResponse.json({ error: "Enter the member email." }, { status: 400 })

  try {
    const report = await runFlowTest(url, email)
    return NextResponse.json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : "The flow test could not finish."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
