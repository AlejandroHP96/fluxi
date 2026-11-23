import { useMemo, useState } from "react"
import { Plus, Search, Undo2, X } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { resolveCategory, todayKey } from "../../utils/month"
import { netAmount, type BudgetCategory, type Expense, type Members, type Themes } from "../../types/budget"
import { themeById } from "../../constants/themes"
import { authorName, isShared, memberInitials } from "../../utils/members"
import { catColor, dayLabel } from "./helpers"

interface ExpenseListProps {
  categories: BudgetCategory[]
  expenses: Expense[] // ya filtrados por mes y ordenados (más recientes primero)
  loading: boolean
  onSelect: (e: Expense) => void
  onAdd: () => void
  members: Members // presupuesto compartido: con más de un miembro se enseña quién apuntó cada gasto
  themes: Themes // tema de cada miembro: su inicial sale con ese color
}

// Burbuja con el color del tema de quien apuntó el gasto
const bubbleStyle = (themeId: string | undefined) => {
  const t = themeById(themeId)
  return { backgroundColor: `rgb(${t.acc[400]} / 0.22)`, color: `rgb(${t.acc[200]})` }
}

export const ExpenseList = ({ expenses, categories, loading, onSelect, onAdd, members, themes }: ExpenseListProps) => {
  const shared = isShared(members)
  const initials = useMemo(() => memberInitials(members), [members])
  const [search, setSearch] = useState("")
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = expenses
    if (selectedCat) {
      list = list.filter((e) => {
        const cat = resolveCategory(e.category, categories)
        return cat ? cat.id === selectedCat : selectedCat === "uncat"
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => {
        const cat = resolveCategory(e.category, categories)
        const catName = cat?.name.toLowerCase() ?? "sin categoría"
        return e.concept.toLowerCase().includes(q) || catName.includes(q)
          || (shared && (authorName(e, members) ?? "").toLowerCase().includes(q))
      })
    }
    return list
  }, [expenses, categories, search, selectedCat, shared, members])

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of filtered) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((a, e) => a + netAmount(e), 0),
    }))
  }, [filtered])

  const totalFilteredAmount = useMemo(() => filtered.reduce((a, e) => a + netAmount(e), 0), [filtered])
  const today = todayKey()

  return (
    <section className="space-y-3.5">
      {/* Encabezado y botón rápido */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Gastos del mes</h2>
          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs tabular-nums text-white/60">
            {expenses.length}
          </span>
        </div>

        <button
          onClick={onAdd}
          className="liquid-button hidden items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-cyan-950 sm:flex"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span>Apuntar gasto</span>
        </button>
      </div>

      {/* Buscador y filtro si hay gastos */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={shared ? "Buscar por comercio, concepto o quién…" : "Buscar por comercio o concepto…"}
              className="glass-input w-full rounded-xl py-2 pl-9 pr-8 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros rápidos de categoría si hay búsqueda activa o muchos gastos */}
          {(search.trim() || selectedCat) && (
            <div className="flex items-center justify-between text-xs text-white/55 px-1">
              <span>
                {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}:{" "}
                <span className="font-semibold text-white/80 tabular-nums">{fmt(totalFilteredAmount)}</span>
              </span>
              {(search || selectedCat) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setSelectedCat(null)
                  }}
                  className="text-cyan-300 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 px-6 py-12 text-center">
          <p className="text-base font-medium text-white/80">Todavía no hay gastos este mes</p>
          <p className="mt-1 text-sm text-white/60">Apunta el primero y verás cómo avanza tu presupuesto.</p>
          <button
            onClick={onAdd}
            className="liquid-button mx-auto mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-cyan-950"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Apuntar gasto
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
          No hay gastos que coincidan con la búsqueda «{search}».
        </div>
      ) : (
        // Una sola tarjeta de alto fijo que se desplaza por dentro; la cabecera del día se queda pegada arriba
        <div className="max-h-[min(30rem,62dvh)] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.07] bg-white/[0.025] nice-scroll">
          {groups.map((g) => (
            <div key={g.date} className="border-white/[0.07] [&:not(:first-child)]:border-t">
              <div className="sticky top-0 z-10 flex items-baseline justify-between bg-[#0c0f16] px-3.5 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55 first-letter:uppercase">
                  {dayLabel(g.date, today)}
                </span>
                {g.items.length > 1 && (
                  <span className="text-[11px] font-medium tabular-nums text-white/45">{fmt(g.total)}</span>
                )}
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {g.items.map((e) => {
                  const cat = resolveCategory(e.category, categories)
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => onSelect(e)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: catColor(categories, cat) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white/95">{e.concept}</span>
                          <span className="block text-xs text-white/50">{cat?.name ?? "Sin categoría"}</span>
                        </span>
                        {shared && (
                          // Inicial de quien lo apuntó
                          <span
                            title={authorName(e, members) ?? undefined}
                            aria-label={`Apuntado por ${authorName(e, members) ?? "alguien que ya no está"}`}
                            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                            style={bubbleStyle(themes[e.createdBy ?? e.userId])}
                          >
                            {initials[e.createdBy ?? e.userId] ?? "?"}
                          </span>
                        )}
                        {e.refunds?.length ? (
                          // Con devoluciones: lo que te ha costado y, debajo, el importe original tachado
                          <span className="shrink-0 text-right">
                            <span className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums text-white/90">
                              <Undo2 className="h-3 w-3 text-emerald-300" />
                              {fmt(netAmount(e))}
                            </span>
                            <span className="block text-[11px] tabular-nums text-white/40 line-through">{fmt(e.amount)}</span>
                          </span>
                        ) : (
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-white/90">{fmt(e.amount)}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
