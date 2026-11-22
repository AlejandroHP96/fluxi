import { useState } from "react"
import { useAuth } from "./hooks/useAuth"
import { useBudget } from "./hooks/useBudget"
import AuthPage from "./pages/AuthPage"
import MonthDashboard from "./pages/MonthDashboard"
import { ZkLoader } from "./components/brand/ZkLoader"
import { BiometricGate } from "./components/security/BiometricGate"

const App = () => {
  const { user, loading: authLoading, signIn, signOut, resetPassword } = useAuth()
  const budget = useBudget(user?.uid)
  // Quien acaba de entrar con contraseña no tiene que poner además la huella (hasta la próxima vez que abra)
  const [passwordSignIn, setPasswordSignIn] = useState(false)
  const signInWithPassword: typeof signIn = async (email, password) => {
    const result = await signIn(email, password)
    if (!result.error) setPasswordSignIn(true)
    return result
  }

  // El loader ZK es siempre el elemento raíz: así no se reinicia al pasar de "cargando" a la app o al login
  if (authLoading || !user) {
    return <ZkLoader isLoading={authLoading}>{authLoading ? null : <AuthPage onSignIn={signInWithPassword} onResetPassword={resetPassword} />}</ZkLoader>
  }

  return (
    <ZkLoader>
      <BiometricGate key={user.uid} uid={user.uid} startUnlocked={passwordSignIn} onUsePassword={signOut}>
        <MonthDashboard email={user.email} onSignOut={signOut} budget={budget} />
      </BiometricGate>
    </ZkLoader>
  )
}

export default App
