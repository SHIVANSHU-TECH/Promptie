export const btn =
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"

export const btnPrimary = `${btn} bg-accent text-white hover:bg-accent-strong`

export const btnGhost = `${btn} border border-line bg-card text-ink hover:bg-accent-soft`

export const btnQuiet = `${btn} text-muted hover:bg-card hover:text-ink`

export const btnDanger = `${btn} border border-warn/30 bg-warn-soft text-warn hover:border-warn`

export const field =
  "w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/80 focus:border-accent"
