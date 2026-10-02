"use client"

import { field } from "@/lib/styles"

export function SlotEditor({
  slots,
  values,
  onChange,
}: {
  slots: string[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted">This template has no slots.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slots.map((key) => {
        const value = values[key] ?? ""
        const open = value.trim().length === 0
        return (
          <label key={key} className="block">
            <span className="mb-1 block font-mono text-xs text-muted">{`{{${key}}}`}</span>
            <input
              id={`slot-${key}`}
              className={`${field} ${open ? "border-warn/50 bg-warn-soft/40" : ""}`}
              value={value}
              autoComplete="off"
              placeholder="Add a value"
              onChange={(event) => onChange(key, event.target.value)}
            />
          </label>
        )
      })}
    </div>
  )
}
