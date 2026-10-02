import type { PromptPart } from "@/lib/prompt"
import { tokenize } from "@/lib/prompt"

export function PromptView({ body, values }: { body: string; values: Record<string, string> }) {
  const parts = tokenize(body, values)
  return (
    <div className="whitespace-pre-wrap font-mono text-sm leading-7 text-prompt-text">
      {parts.map((part, index) => (
        <Part key={index} part={part} />
      ))}
    </div>
  )
}

function Part({ part }: { part: PromptPart }) {
  if (part.type === "text") return <span>{part.text}</span>
  if (part.value) return <span className="text-slot-fill">{part.value}</span>
  return (
    <span className="rounded bg-slot-empty/20 px-1 text-slot-empty">{`{{${part.key}}}`}</span>
  )
}
