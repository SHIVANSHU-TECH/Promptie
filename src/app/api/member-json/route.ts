import { NextResponse } from "next/server"
import { createMemberConfig, memberJson } from "@/lib/member-config"

export const runtime = "nodejs"

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 300) : ""
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 })
  }
  try {
    const result = await createMemberConfig({
      name: text(body.name),
      websiteUrl: text(body.websiteUrl),
      domain: text(body.domain),
      siteId: text(body.siteId),
      widgetId: text(body.widgetId),
      logo: text(body.logo),
      favicon: text(body.favicon),
    })
    return NextResponse.json({ config: result.config, json: memberJson(result.config), note: result.note })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The member JSON could not be built."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
