import { useState } from "react"
import type { FirebaseError } from "firebase/app"
import type { AuthResult } from "../types"
import { DEMO_EMAIL, DEMO_PASSWORD } from "../constants/demo"
import { ZkLogo } from "../components/brand/ZkLogo"

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-email":         "Email no válido.",
  "auth/user-not-found":        "No existe una cuenta con este email.",
  "auth/wrong-password":        "Contraseña incorrecta.",
  "auth/invalid-credential":    "Email o contraseña incorrectos.",
  "auth/too-many-requests":     "Demasiados intentos. Espera un momento.",
  "auth/missing-email":         "Escribe tu email.",
}

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<AuthResult>
  onResetPassword: (email: string) => Promise<AuthResult>
}

// Sin registro: las cuentas se crean a mano (el registro público está cerrado en Firebase)
type AuthMode = "login" | "reset"

const AuthPage = ({ onSignIn, onResetPassword }: AuthPageProps) => {
  const [mode, setMode]       = useState<AuthMode>("login")
  const [email, setEmail]     = useState("")
  const [password, setPass]   = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState("")
  const [err, setErr]         = useState("")

  const handle = async () => {
    if (mode === "reset") return handleReset()
    if (!email || !password) { setErr("Completa todos los campos."); return }
    setLoading(true); setErr(""); setMsg("")

    const { error } = await onSignIn(email, password)
    if (error) setErr(FIREBASE_ERRORS[(error as FirebaseError).code] ?? error.message)
    setLoading(false)
  }

  const handleTester = async () => {
    setLoading(true); setErr(""); setMsg("")
    const { error } = await onSignIn(DEMO_EMAIL, DEMO_PASSWORD)
    if (error) setErr(FIREBASE_ERRORS[(error as FirebaseError).code] ?? error.message)
    setLoading(false)
  }

  // Mensaje igual exista o no la cuenta, para no revelar qué emails están registrados
  const handleReset = async () => {
    if (!email) { setErr("Escribe tu email."); return }
    if (email.trim().toLowerCase() === DEMO_EMAIL) { setErr("La cuenta de prueba no admite cambiar la contraseña."); return }
    setLoading(true); setErr(""); setMsg("")
    const { error } = await onResetPassword(email.trim())
    const code = (error as FirebaseError | null)?.code
    if (error && code !== "auth/user-not-found") setErr(FIREBASE_ERRORS[code ?? ""] ?? error.message)
    else setMsg("Si hay una cuenta con ese email, te llegará un enlace para elegir una contraseña nueva. Mira también en spam.")
    setLoading(false)
  }

  const goTo = (next: AuthMode) => {
    setMode(next)
    setErr("")
    setMsg("")
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-10">
          <ZkLogo id="navbar-brand-logo" className="w-10 h-10" />
          <span className="font-bold text-2xl tracking-tight">Fluxi</span>
        </div>
        {/* <form> con autocomplete: el móvil guarda la contraseña y la rellena con huella / Face ID */}
        <form
          className="glass-panel rounded-3xl p-7"
          onSubmit={(e) => {
            e.preventDefault()
            void handle()
          }}
        >
          <h2 className="text-base font-semibold mb-6">
            {mode === "login" ? "Iniciar sesión" : "Recuperar contraseña"}
          </h2>
          <div className="mb-4">
            <label className="block text-xs text-white/60 mb-1">Email</label>
            <input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="glass-input rounded-xl w-full px-3 py-2 text-sm" />
          </div>
          {mode === "reset" ? (
            <p className="mb-6 text-xs text-white/60">Te enviaremos un enlace para elegir una contraseña nueva.</p>
          ) : (
            <div className="mb-6">
              <label className="block text-xs text-white/60 mb-1">Contraseña</label>
              <input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="glass-input rounded-xl w-full px-3 py-2 text-sm" />
              <button type="button" onClick={() => goTo("reset")} className="mt-2 text-xs text-cyan-300 hover:underline">
                ¿Olvidaste la contraseña?
              </button>
            </div>
          )}
          {err && <p className="text-red-400 text-xs mb-4">{err}</p>}
          {msg && <p className="text-emerald-400 text-xs mb-4">{msg}</p>}
          <button type="submit" disabled={loading}
            className={`liquid-button rounded-xl font-semibold text-[#04202a] w-full py-2.5 text-sm transition-opacity mb-4 ${loading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"}`}>
            {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Enviar enlace"}
          </button>
          {mode === "login" && (
            <button type="button" onClick={handleTester} disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.03] text-white/75 hover:border-cyan-400/40 hover:text-white w-full py-2.5 text-sm font-medium transition-colors mb-4 disabled:opacity-50">
              Entrar como Tester
            </button>
          )}
          {mode === "reset" && (
            <p className="text-center text-xs text-white/60">
              <button type="button" onClick={() => goTo("login")} className="text-cyan-300 hover:underline">Volver a iniciar sesión</button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default AuthPage
