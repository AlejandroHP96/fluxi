import { useState, useEffect } from "react"
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { auth, db } from "../lib/firebase"
import type { AuthResult } from "../types"

export const useAuth = () => {
  const [user, setUser]       = useState<User | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        // Intentar leer foto de perfil de Firestore o de Firebase Auth
        let currentPhoto = u.photoURL || null
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid))
          if (userDoc.exists() && userDoc.data()?.photoUrl) {
            currentPhoto = userDoc.data().photoUrl
          }
        } catch {
          // Ignorar fallback
        }
        setPhotoUrl(currentPhoto)
      } else {
        setPhotoUrl(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const updateAvatar = async (base64OrUrl: string): Promise<boolean> => {
    if (!auth.currentUser) return false
    try {
      // 1. Guardar en Firestore perfil del usuario
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { photoUrl: base64OrUrl, updatedAt: Date.now() },
        { merge: true }
      )
      // 2. Intentar actualizar auth profile si cabe (las URLs o strings cortas)
      try {
        await updateProfile(auth.currentUser, { photoURL: base64OrUrl })
      } catch {
        // En caso de que base64 supere límite de Auth profile, Firestore ya lo tiene guardado
      }
      setPhotoUrl(base64OrUrl)
      return true
    } catch (e) {
      console.error("Error al actualizar foto de perfil:", e)
      return false
    }
  }

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const signOut = () => firebaseSignOut(auth)

  return { user, photoUrl, loading, signUp, signIn, signOut, updateAvatar }
}
