import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDYJdbz01UYSz3MNKG9G04UtQDkgWMWCYk",
  authDomain: "trainerform-52f85.firebaseapp.com",
  databaseURL: "https://trainerform-52f85-default-rtdb.firebaseio.com",
  projectId: "trainerform-52f85",
  storageBucket: "trainerform-52f85.firebasestorage.app",
  messagingSenderId: "226297252007",
  appId: "1:226297252007:web:85ec7514b492547c373382",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db = getFirestore(app)

export const TEMPLATES = "promptie_templates"
export const COMPANIES = "promptie_companies"
export const META = "promptie_meta"
