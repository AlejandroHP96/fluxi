import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  Wallet,
  Plus,
  Upload,
  LogOut,
  Sparkles,
} from "lucide-react"
import { UserAvatar } from "../ui/UserAvatar"

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onAdd: () => void
  onImport: () => void
  onSignOut: () => void
  userEmail: string | null
  photoUrl: string | null
  onUpdateAvatar?: (base64: string) => Promise<boolean>
  txCount: number
}

export const Sidebar = ({
  activeTab,
  setActiveTab,
  onAdd,
  onImport,
  onSignOut,
  userEmail,
  photoUrl,
  onUpdateAvatar,
  txCount,
}: SidebarProps) => {
  const userName = userEmail ? userEmail.split("@")[0] : "Usuario"

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 hidden lg:flex flex-col border-r border-white/[0.08] bg-[#080d16]/80 backdrop-blur-2xl p-5 select-none z-30">
      {/* 1. Header del Workspace */}
      <div className="flex items-center gap-3 px-2 py-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-slate-950 font-black text-base shadow-lg shadow-cyan-500/20 shrink-0">
          F
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-white tracking-tight">Fluxi Finance</span>
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>
          <p className="text-[11px] text-white/40 truncate">Workspace Personal</p>
        </div>
      </div>

      {/* Botones de Acción Rápida */}
      <div className="space-y-2 mb-6">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nuevo Movimiento</span>
        </button>

        <button
          onClick={onImport}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-xs font-medium text-white transition-all hover:border-cyan-500/30"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Importar Extracto</span>
        </button>
      </div>

      {/* 2. Menú de Navegación por Grupos */}
      <nav className="flex-1 space-y-6 overflow-y-auto pr-1">
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-white/30 uppercase px-3 mb-2">
            Panel Principal
          </p>
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className={`w-4 h-4 ${activeTab === "overview" ? "text-cyan-400" : "text-white/40"}`} />
                <span>Dashboard</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("transactions")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "transactions"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ReceiptText className={`w-4 h-4 ${activeTab === "transactions" ? "text-cyan-400" : "text-white/40"}`} />
                <span>Transacciones</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-white/70">
                {txCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "analytics"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className={`w-4 h-4 ${activeTab === "analytics" ? "text-cyan-400" : "text-white/40"}`} />
                <span>Analítica</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("finance")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === "finance"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className={`w-4 h-4 ${activeTab === "finance" ? "text-cyan-400" : "text-white/40"}`} />
                <span>Finanzas</span>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* 3. Footer de Usuario / Perfil en la Sidebar */}
      <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar
            photoUrl={photoUrl}
            email={userEmail}
            size="md"
            editable={true}
            onPhotoUploaded={onUpdateAvatar}
          />
          <div className="min-w-0 pr-1">
            <p className="text-xs font-medium text-white truncate capitalize">{userName}</p>
            <p className="text-[10px] text-white/40 truncate">Cambiar foto</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
