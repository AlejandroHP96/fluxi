import { Search, Plus, Upload } from "lucide-react"
import { MonthSelector } from "../ui/MonthSelector"
import { UserAvatar } from "../ui/UserAvatar"
import type { MonthOption } from "../../utils/dateFilters"

interface TopbarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedMonth: string
  onMonthChange: (m: string) => void
  monthOptions: MonthOption[]
  onAdd: () => void
  onImport: () => void
  userEmail: string | null
  photoUrl: string | null
  onUpdateAvatar?: (base64: string) => Promise<boolean>
}

export const Topbar = ({
  searchQuery,
  onSearchChange,
  selectedMonth,
  onMonthChange,
  monthOptions,
  onAdd,
  onImport,
  userEmail,
  photoUrl,
  onUpdateAvatar,
}: TopbarProps) => {
  const userName = userEmail ? userEmail.split("@")[0] : "Admin"

  return (
    <header className="h-16 px-4 sm:px-8 border-b border-white/[0.08] bg-[#07090e]/60 backdrop-blur-2xl flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* 1. Buscador estilo Píldora (como en el video) */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar gastos, comercios, categorías..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-cyan-500/50 rounded-full pl-9 pr-12 py-2 text-xs text-white placeholder-white/30 transition-all outline-none"
          />
          <span className="absolute right-3 text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 hidden sm:inline">
            ⌘K
          </span>
        </div>
      </div>

      {/* 2. Selector de mes + Acciones */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <MonthSelector
          value={selectedMonth}
          onChange={onMonthChange}
          options={monthOptions}
          showAllOption={true}
        />

        {/* Botón Importar (Visible en Topbar en pantallas medianas) */}
        <button
          onClick={onImport}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-xs font-medium text-white transition-all hover:border-cyan-500/30"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Importar</span>
        </button>

        {/* Botón Añadir */}
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Añadir</span>
        </button>

        <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

        {/* Notificaciones y Perfil */}
        <div className="flex items-center gap-2">
          <UserAvatar
            photoUrl={photoUrl}
            email={userEmail}
            size="md"
            editable={true}
            onPhotoUploaded={onUpdateAvatar}
          />
          <div className="text-left hidden md:block">
            <p className="text-xs font-medium text-white capitalize leading-none">{userName}</p>
            <p className="text-[10px] text-white/40 leading-none mt-1">Owner</p>
          </div>
        </div>
      </div>
    </header>
  )
}
