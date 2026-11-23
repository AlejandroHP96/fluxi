import { useState } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { blankDraft, draftAmountTotal, draftTotal, type DraftCat } from "./categoryDraft"

interface CategoryEditorProps {
  draft: DraftCat[]
  onChange: (draft: DraftCat[]) => void
  onDelete: (row: DraftCat) => void
  sticky?: boolean // dentro de un modal con scroll: suma arriba y «Añadir» abajo siempre a la vista
}

const pctText = (n: number) => `${Math.round(n * 10) / 10} %`.replace(".", ",")

// Suma de % en vivo: sin asignar, todo repartido o te pasas
export const PctTotal = ({ draft }: { draft: DraftCat[] }) => {
  const total = draftTotal(draft)
  const amountTotal = draftAmountTotal(draft)
  const hasAmount = draft.some((d) => d.mode === "eur")
  const hasPct = draft.some((d) => d.mode === "pct")
  // Sin sobres en %, la suma de % no importa: lo que no cubran los € queda libre
  const over = hasPct && total > 100.005
  const free = 100 - total
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        over
          ? "border-amber-400/35 bg-amber-400/[0.09] text-amber-100"
          : free > 0.005
            ? "border-white/12 bg-white/[0.04] text-white/80"
            : "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-100"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold tabular-nums">{hasPct ? `Sumas ${pctText(total)}` : "Sin sobres en %"}</span>
        <span className="text-xs">
          {!hasPct
            ? "Lo que sobre queda libre"
            : over
              ? `Te pasas ${pctText(total - 100)}`
              : free > 0.005
                ? `Sin asignar ${pctText(free)} (dinero libre)`
                : "Todo repartido"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${over ? "bg-amber-400" : "bg-gradient-to-r from-cyan-400 to-emerald-400"}`}
          style={{ width: `${Math.min(100, total)}%` }}
        />
      </div>
      {hasAmount && (
        <p className="mt-2 text-xs text-white/65">
          Sobres en €: <span className="font-semibold tabular-nums text-white/85">{fmt(amountTotal)}</span>
          {hasPct ? " · salen primero y los % se reparten sobre lo que quede" : ""}
        </p>
      )}
      {over && <p className="mt-2 text-xs">Puedes guardarlo igual, pero repartes más de lo que cobras.</p>}
    </div>
  )
}

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"

export const CategoryEditor = ({ draft, onChange, onDelete, sticky = false }: CategoryEditorProps) => {
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const patch = (id: string, p: Partial<DraftCat>) => onChange(draft.map((d) => (d.id === id ? { ...d, ...p } : d)))
  const move = (i: number, delta: number) => {
    const next = [...draft]
    ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
    onChange(next)
  }
  const add = () => {
    const row = blankDraft()
    setJustAdded(row.id)
    onChange([...draft, row])
  }

  return (
    <div className="space-y-3">
      <div className={sticky ? "sticky top-0 z-10 -mx-1 bg-ink-2 px-1 pb-1 pt-1" : ""}>
        <PctTotal draft={draft} />
      </div>

      <ul className="space-y-2.5">
        {draft.map((d, i) => (
          <li key={d.id} className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <input
                value={d.name}
                onChange={(e) => patch(d.id, { name: e.target.value })}
                autoFocus={d.id === justAdded}
                placeholder="Nombre (Ocio, Comida…)"
                aria-label="Nombre de la categoría"
                maxLength={30}
                className="glass-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-base"
              />
              <div className="relative w-[5.5rem] shrink-0">
                <input
                  value={d.mode === "eur" ? d.amount : d.pct}
                  onChange={(e) => patch(d.id, d.mode === "eur" ? { amount: e.target.value } : { pct: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  inputMode="decimal"
                  aria-label={`${d.mode === "eur" ? "Importe" : "Porcentaje"} de ${d.name || "la categoría"}`}
                  className="glass-input w-full rounded-xl py-2.5 pl-3 pr-8 text-right text-base font-semibold tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/60">
                  {d.mode === "eur" ? "€" : "%"}
                </span>
              </div>
              {/* Sobre en % del resto o de importe fijo en € */}
              <div className="flex shrink-0 rounded-xl bg-white/[0.06] p-0.5" role="radiogroup" aria-label={`Tipo de reparto de ${d.name || "la categoría"}`}>
                {(["eur", "pct"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={d.mode === m}
                    aria-label={m === "eur" ? "Importe fijo en euros" : "Porcentaje del resto"}
                    onClick={() => patch(d.id, { mode: m })}
                    className={`h-9 w-8 rounded-lg text-sm font-semibold transition-colors ${
                      d.mode === m ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                    }`}
                  >
                    {m === "eur" ? "€" : "%"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={d.savings}
                onClick={() => patch(d.id, { savings: !d.savings })}
                className="flex items-center gap-2 rounded-lg py-1 pr-1 text-[13px] text-white/80"
              >
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${d.savings ? "bg-cyan-400" : "bg-white/20"}`}>
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${d.savings ? "left-[1.1rem]" : "left-0.5"}`}
                  />
                </span>
                Ahorro <span className="text-white/60">· se aparta</span>
              </button>
              <div className="ml-auto flex items-center">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className={iconBtn}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Bajar" className={iconBtn}>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(d)}
                  aria-label={`Borrar ${d.name || "categoría"}`}
                  className={`${iconBtn} hover:!bg-red-500/10 hover:!text-red-300`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className={sticky ? "sticky bottom-0 z-10 -mx-1 bg-ink-2 px-1 pb-1 pt-2" : ""}>
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-400/[0.06] px-4 py-3 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Añadir categoría
        </button>
      </div>
    </div>
  )
}
