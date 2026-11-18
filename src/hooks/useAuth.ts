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
        // 1. Prioridad: LocalStorage instantáneo (para no depender de cuota o reglas)
        const localPhoto = localStorage.getItem(`fluxi_avatar_${u.uid}`)
        let currentPhoto = localPhoto || u.photoURL || null

        // 2. Intentar leer foto de perfil de Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid))
          if (userDoc.exists() && userDoc.data()?.photoUrl) {
            currentPhoto = userDoc.data().photoUrl as string
            localStorage.setItem(`fluxi_avatar_${u.uid}`, currentPhoto)
          }
        } catch (e) {
          console.warn("Firestore user fetch skipped or restricted, using local/auth photo:", e)
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
    const uid = auth.currentUser.uid
    try {
      // 1. Guardar de forma inmediata en LocalStorage (persistencia local garantizada al instante)
      try {
        localStorage.setItem(`fluxi_avatar_${uid}`, base64OrUrl)
      } catch (e) {
        console.warn("LocalStorage full, continuing to Firestore:", e)
      }
      setPhotoUrl(base64OrUrl)

      // 2. Guardar en Firestore perfil del usuario
      try {
        await setDoc(
          doc(db, "users", uid),
          { photoUrl: base64OrUrl, updatedAt: Date.now() },
          { merge: true }
        )
      } catch (firestoreErr) {
        console.warn("No se pudo escribir en la colección users de Firestore (revisa las security rules):", firestoreErr)
      }

      // 3. Intentar actualizar auth profile si es una URL estándar
      try {
        if (!base64OrUrl.startsWith("data:")) {
          await updateProfile(auth.currentUser, { photoURL: base64OrUrl })
        }
      } catch (authErr) {
        console.warn("updateProfile auth:", authErr)
      }

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
