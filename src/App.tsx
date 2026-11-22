import { useAuth } from "./hooks/useAuth"
import { useBudget } from "./hooks/useBudget"
import AuthPage from "./pages/AuthPage"
import MonthDashboard from "./pages/MonthDashboard"
import { ZkLoader } from "./components/brand/ZkLoader"

const App = () => {
  const { user, loading: authLoading, signIn, signOut, resetPassword } = useAuth()
  const budget = useBudget(user?.uid)

  // El loader ZK es siempre el elemento raíz: así no se reinicia al pasar de "cargando" a la app o al login
  if (authLoading || !user) {
    return <ZkLoader isLoading={authLoading}>{authLoading ? null : <AuthPage onSignIn={signIn} onResetPassword={resetPassword} />}</ZkLoader>
  }

  return (
    <ZkLoader>
      <MonthDashboard email={user.email} onSignOut={signOut} budget={budget} />
    </ZkLoader>
  )
}

export default App
