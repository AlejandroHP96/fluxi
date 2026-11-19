import { useMemo, useState } from "react"
import { Trash2, Tags, Plus } from "lucide-react"
import { SectionHeader, inputClass } from "./FinanceModal"
import { CATEGORIES } from "../../constants/categories"
import { conceptKey, recategorizeOther } from "../../utils/categorize"
import type { FinanceApi } from "../../hooks/useFinance"
import type { Transaction } from "../../types"

type Update = { id: string; description: string; category: string }

interface CategoriesSectionProps {
  transactions: Transaction[]
  finance: FinanceApi
  onUpdateBatch: (updates: Update[]) => Promise<number>
}

const selectClass = `${inputClass} appearance-none cursor-pointer`

const CategorySelect = ({
  value, onChange, className,
}: { value: string; onChange: (v: string) => void; className?: string }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={className ?? selectClass}>
    {(CATEGORIES.includes(value) ? CATEGORIES : [...CATEGORIES, value]).map((c) => (
      <option key={c} value={c} className="bg-slate-900">{c}</option>
    ))}
  </select>
)

export const CategoriesSection = ({ transactions, finance, onUpdateBatch }: CategoriesSectionProps) => {
  const rules = finance.settings.categoryRules
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [newConcept, setNewConcept] = useState("")
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])

  const pending = useMemo(() => recategorizeOther(transactions, rules), [transactions, rules])
  const pendingByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pending) map.set(p.category, (map.get(p.category) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [pending])

  // Gastos por concepto, para saber cuántos movimientos toca cada regla
  const countsByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== "expense") continue
      const k = conceptKey(t.description)
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return map
  }, [transactions])

  const ruleList = useMemo(
    () => Object.entries(rules).sort((a, b) => a[0].localeCompare(b[0])),
    [rules]
  )

  const recategorize = async () => {
    if (pending.length === 0) return
    if (!window.confirm(
      `¿Cambiar la categoría de ${pending.length} gastos que están en «Otro»? Podrás volver a cambiarlas una a una.`
    )) return
    setBusy(true)
    setResult(null)
    const done = await onUpdateBatch(pending)
    setBusy(false)
    setResult(
      done > 0
        ? { ok: true, text: `Se recategorizaron ${done} gastos.` }
        : { ok: false, text: "No se pudo recategorizar nada. Inténtalo de nuevo." }
    )
  }

  // Tras guardar una regla, ofrece aplicarla a los gastos actuales con ese concepto
  const offerApply = async (key: string, category: string) => {
    const toChange = transactions.filter(
      (t) => t.type === "expense" && conceptKey(t.description) === key && t.category !== category
    )
    if (toChange.length === 0) return
    if (!window.confirm(`¿Poner «${category}» también a los ${toChange.length} gastos actuales de «${key}»?`)) return
    setBusy(true)
    const done = await onUpdateBatch(toChange.map((t) => ({ id: t.id, description: t.description, category })))
    setBusy(false)
    setResult(
      done > 0
        ? { ok: true, text: `Se actualizaron ${done} gastos a «${category}».` }
        : { ok: false, text: "No se pudieron actualizar los movimientos. Inténtalo de nuevo." }
    )
  }

  const changeRule = async (key: string, category: string) => {
    setResult(null)
    if (!(await finance.setCategoryRule(key, category))) return
    await offerApply(key, category)
  }

  const removeRule = (key: string) => {
    if (window.confirm(`¿Borrar la regla de «${key}»? Los movimientos ya categorizados no cambian.`)) {
      setResult(null)
      finance.setCategoryRule(key, null)
    }
  }

  const key = conceptKey(newConcept)
  const addRule = async () => {
    if (!key) return
    setResult(null)
    if (!(await finance.setCategoryRule(key, newCategory))) return
    setNewConcept("")
    await offerApply(key, newCategory)
  }

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <SectionHeader
        title="Categorías"
        subtitle="Reglas para que cada concepto vaya siempre a su categoría"
      />

      {/* Recategorizar Otro */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Recategorizar «Otro»</p>
            <p className="text-xs text-white/50 mt-0.5">
              {pending.length === 0
                ? "No hay gastos en «Otro» que ahora tengan categoría."
                : `${pending.length} gastos en «Otro» tendrían categoría ahora.`}
            </p>
          </div>
          {pending.length > 0 && (
            <button
              onClick={recategorize}
              disabled={busy}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 transition-all disabled:opacity-50"
            >
              {busy ? "Aplicando..." : `Recategorizar ${pending.length}`}
            </button>
          )}
        </div>
        {pendingByCategory.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {pendingByCategory.map(([cat, n]) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.04] border border-white/10 text-white/70"
              >
                {cat} <span className="font-mono text-cyan-300 ml-1">{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {result && (
        <p className={`text-xs mt-3 ${result.ok ? "text-emerald-400" : "text-rose-400"}`}>{result.text}</p>
      )}

      {/* Tus reglas */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Tags className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-bold text-white">Tus reglas</h4>
        </div>

        {ruleList.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
            Aún no tienes reglas. Crea una aquí abajo o al editar un movimiento.
          </p>
        ) : (
          <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03]">
            {ruleList.map(([k, cat]) => {
              const n = countsByKey.get(k) ?? 0
              return (
                <div key={k} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate" title={k}>{k}</p>
                    <p className="text-[11px] text-white/40">
                      {n === 0 ? "Ningún movimiento ahora" : n === 1 ? "1 movimiento" : `${n} movimientos`}
                    </p>
                  </div>
                  <CategorySelect
                    value={cat}
                    onChange={(v) => v !== cat && changeRule(k, v)}
                    className={`${selectClass} !w-36 shrink-0`}
                  />
                  <button
                    onClick={() => removeRule(k)}
                    title="Borrar regla"
                    className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Nueva regla a mano */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <input
            type="text"
            placeholder="Concepto (p. ej. «Mercadona»)"
            value={newConcept}
            onChange={(e) => setNewConcept(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            className={inputClass}
          />
          <CategorySelect value={newCategory} onChange={setNewCategory} className={`${selectClass} sm:!w-40`} />
          <button
            onClick={addRule}
            disabled={!key || busy}
            className="liquid-button flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shrink-0 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            Añadir regla
          </button>
        </div>
        {newConcept.trim() && key && key !== newConcept.trim() && (
          <p className="text-[11px] text-white/40 mt-1.5">Se guardará como «{key}».</p>
        )}

        <p className="text-[11px] text-white/40 mt-4 leading-relaxed">
          También se crean reglas al editar un movimiento y marcar la casilla de ponerlo en todos los movimientos
          de ese concepto.
        </p>
      </div>
    </section>
  )
}
