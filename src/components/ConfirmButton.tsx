"use client"

import { useState } from "react"
import { btnDanger, btnGhost } from "@/lib/styles"

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button type="button" className={className ?? btnDanger} onClick={() => setArmed(true)}>
        {label}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={btnDanger} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className={btnGhost} onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  )
}
