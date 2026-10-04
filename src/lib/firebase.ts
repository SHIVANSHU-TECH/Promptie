import { initializeApp, getApps } from "firebase/app"
import { browserLocalPersistence, getAuth, initializeAuth, type Auth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDPKBEDG12WIUDTKadDtpI2wyr7Jn5caeQ",
  authDomain: "promotional-926f4.firebaseapp.com",
  projectId: "promotional-926f4",
  storageBucket: "promotional-926f4.firebasestorage.app",
  messagingSenderId: "267419661014",
  appId: "1:267419661014:web:318b0c7c2904085af64f77",
  measurementId: "G-36VWG5ET68",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

function createAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: browserLocalPersistence })
  } catch {
    return getAuth(app)
  }
}

export const auth = createAuth()
export const db = getFirestore(app)

export function startAnalytics() {
  if (typeof window === "undefined") return
  void import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) => isSupported().then((ok) => (ok ? getAnalytics(app) : null)))
    .catch(() => undefined)
}

export const TEMPLATES = "promptie_templates"
export const COMPANIES = "promptie_companies"
export const META = "promptie_meta"
