import { LogOut, SlidersHorizontal, Upload } from "lucide-react"
import { ZkLogo } from "../brand/ZkLogo"

interface AppHeaderProps {
  email: string | null
  onSignOut: () => void
  onImport: () => void
  onCategories: () => void
}

export const AppHeader = ({ email, onSignOut, onImport, onCategories }: AppHeaderProps) => (
  <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090e]/80 backdrop-blur-xl">
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <ZkLogo id="navbar-brand-logo" className="h-8 w-8 shrink-0" />
        <span className="text-[17px] font-semibold tracking-tight">Fluxi</span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        {email && <span className="hidden min-w-0 max-w-[9rem] truncate text-xs text-white/60 min-[400px]:block sm:max-w-[16rem]">{email}</span>}
        <button
          onClick={onCategories}
          aria-label="Categorías y reparto"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Reparto</span>
        </button>
        <button
          onClick={onImport}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="sm:hidden">Importar</span>
          <span className="hidden sm:inline">Importar CSV</span>
        </button>
        <button
          onClick={onSignOut}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </div>
  </header>
)
