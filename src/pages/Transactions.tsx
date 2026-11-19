import { useState, useMemo, useEffect, useRef } from "react"
import { Trash2, Loader2 } from "lucide-react"
import TransactionRow from "../components/transactions/TransactionRow"
import TransactionDetailModal from "../components/transactions/TransactionDetailModal"
import { MonthSelector } from "../components/ui/MonthSelector"
import { fmtDec } from "../utils/formatters"
import { getAvailableMonths, filterTransactionsByMonth } from "../utils/dateFilters"
import type { Transaction } from "../types"

const FILTERS: Record<string, string> = {
  all: "Todos",
  income: "Ingresos",
  expense: "Gastos",
}

interface TransactionsProps {
  transactions: Transaction[]
  searchQuery?: string
  onDelete: (id: string) => Promise<boolean>
  onDeleteAll?: () => Promise<boolean>
}

const Transactions = ({ transactions, searchQuery = "", onDelete, onDeleteAll }: TransactionsProps) => {
  const [deletingAll, setDeletingAll] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const monthOptions = useMemo(() => getAvailableMonths(transactions), [transactions])
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return monthOptions[0]?.key || "all"
  })
  const [typeFilter, setTypeFilter] = useState("all")

  // Estado para scroll infinito (50 elementos iniciales, +50 al llegar abajo)
  const PAGE_SIZE = 50
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Reiniciar el contador visible al cambiar de mes o filtro
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedMonth, typeFilter, searchQuery])

  const filtered = useMemo(() => {
    // Con búsqueda activa se busca en todos los meses, no solo en el seleccionado
    const q = searchQuery.trim().toLowerCase()
    let result = q ? transactions : filterTransactionsByMonth(transactions, selectedMonth)
    if (q) {
      result = result.filter((t) =>
        t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      )
    }
    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, selectedMonth, typeFilter, searchQuery])

  // Transacciones efectivamente renderizadas en pantalla
  const visibleTransactions = useMemo(() => {
    return filtered.slice(0, visibleCount)
  }, [filtered, visibleCount])

  const hasMore = visibleCount < filtered.length

  // IntersectionObserver para detectar cuándo el usuario está llegando al final
  useEffect(() => {
    const el = observerTarget.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length))
        }
      },
      { rootMargin: "250px" } // Comienza a cargar 250px antes de llegar al fondo
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, filtered.length])

  return (
    <div className="fade-up space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Transacciones</h2>
          <p className="text-xs text-white/50 mt-0.5">
            {filtered.length} movimiento{filtered.length !== 1 ? "s" : ""} registrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onDeleteAll && transactions.length > 0 && (
            <button
              onClick={async () => {
                if (window.confirm(`¿Estás seguro de que quieres eliminar TODOS los datos (${transactions.length} transacciones)? Esta acción no se puede deshacer.`)) {
                  setDeletingAll(true)
                  await onDeleteAll()
                  setDeletingAll(false)
                }
              }}
              disabled={deletingAll}
              title="Borrar todas las transacciones de la cuenta"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{deletingAll ? "Borrando..." : "Borrar todo"}</span>
            </button>
          )}

          <MonthSelector
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthOptions}
            showAllOption={true}
          />

          <div className="flex gap-1 glass-card p-1 rounded-xl">
            {Object.entries(FILTERS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${
                  typeFilter === key
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista Móvil */}
      <div className="sm:hidden glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-white/40 text-xs">
            No hay transacciones registradas en este periodo.
          </p>
        ) : (
          visibleTransactions.map((t) => (
            <div key={t.id} onClick={() => setSelectedTx(t)} className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] cursor-pointer">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-xs font-semibold text-white truncate">{t.description}</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  <span className="text-white/70">{t.date.split(" ")[0]}</span>
                  {t.date.includes(" ") && (
                    <span className="text-cyan-400/80 ml-1.5 font-mono">{t.date.split(" ")[1]}</span>
                  )}
                  {" "}· <span className="text-white/60">{t.category}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs font-mono font-bold ${
                    t.type === "income" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {t.type === "income" ? "+" : ""}
                  {fmtDec(t.amount)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id) }}
                  className="w-6 h-6 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors text-base"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tabla Desktop */}
      <div className="hidden sm:block glass-card rounded-2xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              {["Fecha", "Descripción", "Categoría", "Importe", ""].map((h, i) => (
                <th
                  key={i}
                  className={`px-5 py-3.5 text-[11px] text-white/40 font-semibold uppercase tracking-wider ${
                    i === 3 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center text-white/40 text-xs">
                  No hay transacciones registradas en este periodo.
                </td>
              </tr>
            ) : (
              visibleTransactions.map((t, i) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  onDelete={onDelete}
                  onSelect={setSelectedTx}
                  isEven={i % 2 === 0}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTx && (
        <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}

      {/* Elemento disparador de scroll infinito */}
      {hasMore && (
        <div ref={observerTarget} className="py-4 flex items-center justify-center gap-2 text-xs text-white/40">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Cargando más movimientos... ({visibleTransactions.length} de {filtered.length})</span>
        </div>
      )}
    </div>
  )
}

export default Transactions
