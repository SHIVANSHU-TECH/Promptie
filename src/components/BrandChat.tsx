"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore"
import { COMPANIES, db } from "@/lib/firebase"
import { createId, fillPrompt } from "@/lib/prompt"
import { btnGhost, btnPrimary, field } from "@/lib/styles"
import { useStore } from "@/lib/store"

type DraftPrompt = {
  title: string
  category: string
  description: string
  body: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
  prompt: DraftPrompt | null
  savedTemplateId: string | null
}

function stamp() {
  return Date.now()
}

const actions = [
  {
    kind: "modify" as const,
    label: "Modify this prompt",
    text: "Modify the one selected library prompt for this project. Keep the {{slots}}, make the instructions sharper and more complete, and return it as a library prompt with a clear title.",
  },
  {
    kind: "merge" as const,
    label: "Merge selected prompts",
    text: "Combine the selected library prompts into one reusable prompt. Keep every distinct requirement and the {{slots}}, and give the result a clear title.",
  },
  {
    kind: "write" as const,
    label: "Write a new prompt",
    text: "Write a new reusable prompt this team can run for the brand. Give it a specific title, a category, and {{slot}} placeholders for anything that changes per company.",
  },
]

export function BrandChat() {
  const { ready, companies, templates, selectedCompanyId, activeTemplateId, saveTemplate } = useStore()
  const company = companies.find((item) => item.id === selectedCompanyId) ?? null
  const template = templates.find((item) => item.id === activeTemplateId) ?? null
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftPrompt>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const selectedIds = picked ?? (template ? [template.id] : [])

  useEffect(() => {
    document.title = company ? `Chat · ${company.name}` : "Chat · Promptie"
  }, [company])

  useEffect(() => {
    if (!company) return
    const messagesQuery = query(collection(db, COMPANIES, company.id, "messages"), orderBy("createdAt", "asc"))
    return onSnapshot(messagesQuery, (snap) => {
      setMessages(
        snap.docs
          .map((item) => {
            const data = item.data()
            const role = data.role === "assistant" ? "assistant" : data.role === "user" ? "user" : null
            if (!role || typeof data.content !== "string") return null
            const prompt = asStoredPrompt(data.prompt)
            return {
              id: item.id,
              role,
              content: data.content,
              createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
              prompt,
              savedTemplateId: typeof data.savedTemplateId === "string" ? data.savedTemplateId : null,
            } satisfies ChatMessage
          })
          .filter((item): item is ChatMessage => item !== null),
      )
    })
  }, [company])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages, pending])

  useEffect(() => {
    if (!copiedKey) return
    const timer = window.setTimeout(() => setCopiedKey(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copiedKey])

  function toggleTemplate(id: string) {
    setPicked((current) => {
      const base = current ?? (template ? [template.id] : [])
      return base.includes(id) ? base.filter((item) => item !== id) : [...base, id]
    })
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement("textarea")
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
    setCopiedKey(key)
  }

  async function send(text?: string) {
    const content = (text ?? draft).trim()
    if (!content || !company || pending) return
    if (content.startsWith("Modify the one selected") && selectedIds.length !== 1) {
      setError("Check one prompt, then modify it.")
      return
    }
    if (content.startsWith("Combine the selected") && selectedIds.length < 2) {
      setError("Check at least two prompts, then merge them.")
      return
    }
    setDraft("")
    setPending(true)
    setError(null)
    const history = [
      ...messages.map((item) => ({
        role: item.role,
        content: item.prompt
          ? `${item.content}\n\nPROMPT TITLE: ${item.prompt.title}\n${item.prompt.body}`
          : item.content,
      })),
      { role: "user" as const, content },
    ]
    const chosen = templates.filter((item) => selectedIds.includes(item.id))
    const modifying = content.startsWith("Modify the one selected")
    const authoring = /^(Modify the one selected|Combine the selected|Write a new reusable prompt)/.test(content)
    const focus = modifying ? chosen[0] : template
    try {
      await addDoc(collection(db, COMPANIES, company.id, "messages"), {
        role: "user",
        content,
        createdAt: stamp(),
      })
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company.name,
          values: company.values,
          templateTitle: focus?.title ?? "",
          templateBody: focus?.body ?? "",
          filledPrompt: authoring ? "" : focus ? fillPrompt(focus.body, company.values) : "",
          templates: (modifying && focus ? [focus] : chosen).map((item) => ({
            title: item.title,
            category: item.category,
            body: item.body,
          })),
          messages: history,
        }),
      })
      const payload = (await response.json()) as { reply?: string; prompt?: DraftPrompt | null; error?: string }
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Groq could not answer.")
      }
      if (authoring && !payload.prompt) {
        throw new Error("Groq answered without a prompt. Try again.")
      }
      await addDoc(collection(db, COMPANIES, company.id, "messages"), {
        role: "assistant",
        content: payload.reply,
        createdAt: stamp(),
        ...(payload.prompt ? { prompt: payload.prompt } : {}),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Groq could not answer.")
    } finally {
      setPending(false)
    }
  }

  async function addPrompt(message: ChatMessage, prompt: DraftPrompt) {
    if (!company || !prompt.title.trim() || !prompt.body.trim()) return
    const id = createId("tpl")
    saveTemplate({
      id,
      title: prompt.title.trim(),
      category: prompt.category.trim() || "General",
      description: prompt.description.trim(),
      body: prompt.body,
      updatedAt: stamp(),
    })
    await updateDoc(doc(db, COMPANIES, company.id, "messages", message.id), { savedTemplateId: id })
  }

  if (!ready) {
    return <div className="grid h-full place-items-center bg-paper text-sm text-muted">Loading the library from Firebase…</div>
  }

  if (!company) {
    return (
      <div className="grid h-full place-items-center bg-paper px-6 text-center text-sm leading-6 text-muted">
        Add a company first. Chat stays with that brand.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-paper">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-rail lg:flex">
        <div className="border-b border-line p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Brand</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{company.name}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {template ? `Open prompt: ${template.title}` : "No prompt is open on the board."}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <p className="px-2 text-xs font-medium tracking-wide text-muted uppercase">Prompts to use</p>
          <p className="px-2 pt-1 text-xs leading-5 text-muted">Check one to modify it. Check two or more to merge them.</p>
          <ul className="mt-2 space-y-1">
            {templates.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-card">
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleTemplate(item.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="block text-xs text-muted">{item.category}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={btnGhost}
              disabled={
                pending ||
                (action.kind === "modify" && selectedIds.length !== 1) ||
                (action.kind === "merge" && selectedIds.length < 2)
              }
              onClick={() => void send(action.text)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <details className="border-b border-line px-4 py-2 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">
            Prompts to use ({selectedIds.length})
          </summary>
          <ul className="mt-2 space-y-1 pb-2">
            {templates.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleTemplate(item.id)}
                  />
                  <span className="text-sm">{item.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </details>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-line bg-card px-4 py-4">
                <p className="text-sm font-medium">Chat with {company.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Check one prompt and modify it for this project, or check several and merge them into one. Add the
                  result to the library, then open it on the Board and copy it for this company.
                </p>
              </div>
            ) : null}
            {messages.map((message) => {
              const prompt = message.prompt ? (drafts[message.id] ?? message.prompt) : null
              return (
                <article
                  key={message.id}
                  className={`max-w-[42rem] rounded-lg px-4 py-3 text-sm leading-6 ${
                    message.role === "user" ? "ml-auto bg-accent-soft" : "border border-line bg-card"
                  }`}
                >
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
                    {message.role === "user" ? "You" : "Groq"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {prompt ? (
                    <div className="mt-3 overflow-hidden rounded-lg bg-prompt text-prompt-text">
                      <div className="grid gap-2 border-b border-white/10 px-3 py-3 sm:grid-cols-2">
                        <label>
                          <span className="mb-1 block text-xs text-white/60">Title</span>
                          <input
                            className="w-full rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
                            value={prompt.title}
                            disabled={Boolean(message.savedTemplateId)}
                            onChange={(event) =>
                              setDrafts((current) => ({ ...current, [message.id]: { ...prompt, title: event.target.value } }))
                            }
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs text-white/60">Category</span>
                          <input
                            className="w-full rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
                            value={prompt.category}
                            disabled={Boolean(message.savedTemplateId)}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [message.id]: { ...prompt, category: event.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      {prompt.description ? (
                        <p className="border-b border-white/10 px-3 py-2 text-xs leading-5 text-white/70">{prompt.description}</p>
                      ) : null}
                      <pre className="max-h-72 overflow-auto px-3 py-3 font-mono text-xs leading-5 whitespace-pre-wrap">
                        {prompt.body}
                      </pre>
                      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2">
                        <button
                          type="button"
                          className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-ink"
                          onClick={() => void copyText(`${message.id}:raw`, prompt.body)}
                        >
                          {copiedKey === `${message.id}:raw` ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white"
                          onClick={() => void copyText(`${message.id}:filled`, fillPrompt(prompt.body, company.values))}
                        >
                          {copiedKey === `${message.id}:filled` ? "Copied" : `Copy for ${company.name}`}
                        </button>
                        {message.savedTemplateId ? (
                          <Link href={`/templates/${message.savedTemplateId}`} className="text-xs text-slot-fill underline">
                            In the library
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white"
                            onClick={() => void addPrompt(message, prompt)}
                          >
                            Add to library
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
            {pending ? <p className="text-sm text-muted">Groq is writing…</p> : null}
            {error ? <p className="text-sm text-warn">{error}</p> : null}
            <div ref={bottomRef} />
          </div>
        </div>
        <form
          className="border-t border-line bg-paper"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-3 px-4 py-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message {company.name}</span>
              <textarea
                className={`${field} min-h-12 resize-y`}
                value={draft}
                rows={2}
                placeholder={`Enhance, combine, or ask about ${company.name}`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
              />
            </label>
            <button type="submit" className={btnPrimary} disabled={pending || draft.trim().length === 0}>
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function asStoredPrompt(value: unknown): DraftPrompt | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.title !== "string" || typeof record.body !== "string") return null
  return {
    title: record.title,
    category: typeof record.category === "string" ? record.category : "General",
    description: typeof record.description === "string" ? record.description : "",
    body: record.body,
  }
}
