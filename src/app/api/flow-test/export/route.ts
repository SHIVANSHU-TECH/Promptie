import { NextResponse } from "next/server"
import { reportPdf, reportWorkbook } from "@/lib/flow-export"
import type { FlowReport } from "@/lib/flow-report"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json()) as { format?: unknown; report?: FlowReport }
  if (!body.report?.checks) return NextResponse.json({ error: "Run a test before exporting." }, { status: 400 })
  const stamp = body.report.startedAt.slice(0, 19).replace(/[:T]/g, "-")
  if (body.format === "pdf") {
    return new NextResponse(new Uint8Array(reportPdf(body.report)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="promptie-flow-${stamp}.pdf"`,
      },
    })
  }
  return new NextResponse(reportWorkbook(body.report), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="promptie-flow-${stamp}.xls"`,
    },
  })
}
