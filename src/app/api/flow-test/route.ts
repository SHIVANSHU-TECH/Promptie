import { runFlowTest } from "@/lib/flow-test"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  let url = ""
  try {
    const body = (await request.json()) as { url?: unknown }
    url = typeof body.url === "string" ? body.url : ""
  } catch {
    return Response.json({ error: "Send the store link as JSON." }, { status: 400 })
  }
  if (!url.trim()) return Response.json({ error: "Enter the Lovable or live link." }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }
      send({ type: "frame", label: "Starting the browser" })
      try {
        const report = await runFlowTest(url, "", (frame) => {
          send({ type: "frame", phone: frame.phone, laptop: frame.laptop, label: frame.label })
        })
        send({ type: "report", report })
      } catch (error) {
        const message = error instanceof Error ? error.message : "The flow test could not finish."
        send({ type: "error", error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}
