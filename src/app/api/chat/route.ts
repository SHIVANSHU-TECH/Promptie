import Groq from "groq-sdk"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

type ChatTurn = { role: "user" | "assistant"; content: string }

type ChatBody = {
  companyName?: unknown
  values?: unknown
  templateTitle?: unknown
  templateBody?: unknown
  filledPrompt?: unknown
  templates?: unknown
  messages?: unknown
}

type DraftPrompt = {
  title: string
  category: string
  description: string
  body: string
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  return Object.fromEntries(entries.slice(0, 40).map(([key, text]) => [key.slice(0, 80), text.slice(0, 2000)]))
}

function asTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const role = (item as ChatTurn).role
      const content = (item as ChatTurn).content
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null
      const trimmed = content.trim().slice(0, role === "assistant" ? 12000 : 4000)
      if (!trimmed) return null
      return { role, content: trimmed }
    })
    .filter((item): item is ChatTurn => item !== null)
    .slice(-16)
}

function asTemplates(value: unknown): { title: string; category: string; body: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>
      const title = typeof record.title === "string" ? record.title.trim() : ""
      const body = typeof record.body === "string" ? record.body.trim() : ""
      if (!title || !body) return null
      return {
        title: title.slice(0, 160),
        category: (typeof record.category === "string" ? record.category.trim() : "General").slice(0, 60),
        body: body.slice(0, 8000),
      }
    })
    .filter((item): item is { title: string; category: string; body: string } => item !== null)
    .slice(0, 8)
}

function asDraftPrompt(value: unknown): DraftPrompt | null {
  if (typeof value === "string" && value.trim()) {
    return {
      title: "Reusable prompt",
      category: "General",
      description: "",
      body: value.trim().slice(0, 20000),
    }
  }
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const title = typeof record.title === "string" ? record.title.trim() : typeof record.name === "string" ? record.name.trim() : ""
  const rawBody = [record.body, record.content, record.text, record.prompt].find((item) => typeof item === "string") as
    | string
    | undefined
  const body = rawBody?.trim() ?? ""
  if (!body) return null
  return {
    title: (title || "Reusable prompt").slice(0, 120),
    category: (typeof record.category === "string" ? record.category.trim() : "General").slice(0, 60) || "General",
    description: (typeof record.description === "string" ? record.description.trim() : "").slice(0, 240),
    body: body.slice(0, 20000),
  }
}

function parseModel(text: string): { reply: string; prompt: DraftPrompt | null } {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  try {
    const data = JSON.parse(candidate) as Record<string, unknown>
    const reply = typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : "Here is the prompt."
    return { reply, prompt: asDraftPrompt(data.prompt) }
  } catch {
    return { reply: trimmed, prompt: null }
  }
}

function brandBrief(
  name: string,
  values: Record<string, string>,
  templateTitle: string,
  templateBody: string,
  filledPrompt: string,
  library: { title: string; category: string; body: string }[],
) {
  const lines = Object.entries(values)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `- ${key}: ${value.trim()}`)
  const parameters = lines.length ? lines.join("\n") : "- No parameters saved yet."
  const open = templateBody.trim()
    ? `\nPrompt open on the board ("${templateTitle || "Untitled"}"):\n${templateBody.trim().slice(0, 12000)}`
    : ""
  const selected = library.length
    ? `\nSelected library prompts:\n${library
        .map((item) => `### ${item.title} (${item.category})\n${item.body}`)
        .join("\n\n")}`
    : ""
  const filled = filledPrompt.trim() ? `\nThat open prompt filled for ${name}:\n${filledPrompt.trim().slice(0, 6000)}` : ""
  return `You are Promptie's assistant for the brand ${name}. Help the team write, enhance, and combine reusable prompts for this brand.

Reply with JSON only, no markdown fence:
{"reply":"one or two sentences","prompt":null}
or
{"reply":"what you changed","prompt":{"title":"short specific title","category":"Payments","description":"one line","body":"the full prompt"}}

If the user asks you to write, enhance, or combine a prompt, prompt must be an object with title, category, description, and body. Use prompt:null only when they are asking a question and do not want a prompt.
In prompt.body keep {{slot}} placeholders for anything that changes per company, especially brand_name and project_name. Do not replace those slots with this brand's real values.
The title must name the job, not the brand.
Do not repeat the full prompt inside reply.
Do not invent API keys or secrets.

Brand parameters:
${parameters}${open}${filled}${selected}`
}

function wantsDraft(turns: ChatTurn[]) {
  const last = turns[turns.length - 1]?.content ?? ""
  return /\b(enhance|modify|combin|merge|write a new|library prompt|reusable prompt)\b/i.test(last)
}

export async function POST(request: Request) {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    return NextResponse.json({ error: "Groq is not configured on the server." }, { status: 503 })
  }

  let body: ChatBody
  try {
    body = (await request.json()) as ChatBody
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 })
  }

  const companyName = typeof body.companyName === "string" ? body.companyName.trim().slice(0, 120) : ""
  if (!companyName) {
    return NextResponse.json({ error: "Choose a company before chatting." }, { status: 400 })
  }

  const turns = asTurns(body.messages)
  if (!turns.length || turns[turns.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "Send a message first." }, { status: 400 })
  }

  const values = asRecord(body.values)
  const templateTitle = typeof body.templateTitle === "string" ? body.templateTitle.slice(0, 160) : ""
  const templateBody = typeof body.templateBody === "string" ? body.templateBody : ""
  const filledPrompt = typeof body.filledPrompt === "string" ? body.filledPrompt : ""
  const library = asTemplates(body.templates)
  const groq = new Groq({ apiKey: key })

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.4,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: brandBrief(companyName, values, templateTitle, templateBody, filledPrompt, library),
        },
        ...turns,
      ],
    })
    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) {
      return NextResponse.json({ error: "Groq returned an empty answer." }, { status: 502 })
    }
    let parsed = parseModel(text)
    if (!parsed.prompt && wantsDraft(turns)) {
      const retry = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: brandBrief(companyName, values, templateTitle, templateBody, filledPrompt, library),
          },
          ...turns,
          { role: "assistant", content: text.slice(0, 6000) },
          {
            role: "user",
            content:
              'Return JSON only. Set "prompt" to an object with title, category, description, and body. Keep {{slot}} placeholders in body. Do not put the full prompt in reply.',
          },
        ],
      })
      const retried = retry.choices[0]?.message?.content?.trim()
      if (retried) {
        const second = parseModel(retried)
        if (second.prompt) parsed = second
      }
    }
    return NextResponse.json(parsed)
  } catch (error) {
    console.error("Groq chat failed", error)
    return NextResponse.json({ error: "Groq could not answer. Try again." }, { status: 502 })
  }
}
