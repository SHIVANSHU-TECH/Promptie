"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth"
import { auth, startAnalytics } from "./firebase"
import { UserGuide } from "@/components/UserGuide"

type AuthState = {
  ready: boolean
  user: User | null
  error: string | null
  pending: boolean
  signIn: () => void
  signOutUser: () => void
}

const AuthContext = createContext<AuthState | null>(null)
const google = new GoogleAuthProvider()
google.setCustomParameters({ prompt: "select_account" })

function authMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: string }).code) : ""
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return null
  if (code.includes("popup-blocked")) return "Allow pop-ups for this site, then continue with Google."
  if (code.includes("operation-not-allowed")) return "Turn on the Google provider in Firebase Authentication, then try again."
  if (code.includes("unauthorized-domain")) return "Add this site under Firebase Authentication authorized domains."
  return "Google sign-in did not finish. Try again."
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    startAnalytics()
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setReady(true)
    })
  }, [])

  const api = useMemo<AuthState>(
    () => ({
      ready,
      user,
      error,
      pending,
      signIn: () => {
        setPending(true)
        setError(null)
        void signInWithPopup(auth, google, browserPopupRedirectResolver)
          .catch((err) => setError(authMessage(err)))
          .finally(() => setPending(false))
      },
      signOutUser: () => {
        void signOut(auth).catch(() => setError("Sign-out did not finish. Try again."))
      },
    }),
    [ready, user, error, pending],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth()
  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-paper text-sm text-muted">Checking your sign-in…</div>
    )
  }
  if (!user) return <SignInScreen />
  return children
}

function SignInScreen() {
  const { pending, error, signIn } = useAuth()
  return (
    <div className="grid h-full place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card px-6 py-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-lg font-semibold text-white">P</span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Prompt library</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Promptie</h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          One library for every brand. Fill a prompt, look up a site id and chat widget, build a member JSON, and test
          checkout from the same place. Sign in with Google to open it. How to use walks through the whole path.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-line bg-white text-sm font-medium text-ink transition hover:bg-rail disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          onClick={signIn}
        >
          <GoogleMark />
          {pending ? "Opening Google…" : "Continue with Google"}
        </button>
        {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
        <div className="mt-6 border-t border-line pt-4">
          <UserGuide tone="card" />
        </div>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.3-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}
