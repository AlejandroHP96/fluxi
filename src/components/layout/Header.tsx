import { Plus, Upload, LogOut, LayoutDashboard, ReceiptText, BarChart3 } from "lucide-react"

interface HeaderProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onAdd: () => void
  onImport: () => void
  onSignOut: () => void
  userEmail: string | null
  onReset?: () => void
}

const NAV_ITEMS = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "transactions", label: "Transacciones", icon: ReceiptText },
  { id: "analytics", label: "Analítica", icon: BarChart3 },
]

const Header = ({ activeTab, setActiveTab, onAdd, onImport, onSignOut, userEmail, onReset }: HeaderProps) => (
  <header className="sticky top-0 z-40 border-b border-white/8 glass-panel px-4 sm:px-8 backdrop-blur-xl">
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between h-16">
        {/* Logo & Marca */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-slate-950 font-black text-base shadow-lg shadow-cyan-500/20">
            F
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">Fluxi</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hidden sm:inline-block">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-white/40 leading-none hidden sm:block">Gestión Financiera</p>
          </div>
        </div>

        {/* Pestañas Desktop */}
        <nav className="hidden md:flex items-center gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white/10 text-white shadow-sm border border-white/10 font-semibold"
                    : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : ""}`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Acciones & Perfil */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onReset && (
            <button
              onClick={onReset}
              className="px-2.5 py-1.5 rounded-xl border border-white/10 text-xs font-medium text-white/50 hover:text-white hover:border-cyan-500/40 transition-colors"
            >
              Demo
            </button>
          )}

          {/* Botón Importar */}
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-white transition-all hover:border-cyan-500/40"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Importar</span>
          </button>

          {/* Botón Añadir */}
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Añadir</span>
          </button>

          {/* Salir */}
          <button
            onClick={onSignOut}
            title={userEmail || "Cerrar sesión"}
            className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pestañas Móvil */}
      <nav className="flex md:hidden gap-1 pb-2.5 pt-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-cyan-400 border border-white/10 font-semibold"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  </header>
)

export default Header
