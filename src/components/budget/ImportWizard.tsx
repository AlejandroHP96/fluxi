import { useEffect, useRef, useState, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { X, FileUp, Loader2, CheckCircle2 } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { monthLabel } from "../../utils/month"
import { monthsInCsv, parseRevolutExpenses, type CsvExpense } from "../../utils/revolutCsv"
import { applyVentajon, buildImportQueue, SKIP, ventajonMonths, type ImportItem } from "../../utils/importQueue"
import { fetchVentajonPurchases } from "../../utils/ventajonClient"
import type { BudgetApi } from "../../hooks/useBudget"
import { ImportReview, type Decision } from "./ImportReview"

interface ImportWizardProps {
  budget: BudgetApi
  viewMonth: string // mes que se está viendo en el dashboard
  onClose: (importedMonth?: string) => void // con mes si se guardó algo, para saltar a él
}

type Step = "upload" | "month" | "ventajon" | "review" | "summary"

export const ImportWizard = ({ budget, viewMonth, onClose }: ImportWizardProps) => {
  const [step, setStep] = useState<Step>("upload")
  const [rows, setRows] = useState<CsvExpense[]>([])
  const [month, setMonth] = useState("")
  const [queue, setQueue] = useState<ImportItem[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const months = monthsInCsv(rows)
  const savedCount = (d: Decision[]) => d.filter((x) => x.choice !== SKIP).length

  // Bloquea el scroll del fondo; fuera de la revisión, Esc cierra (en la revisión lo gestiona ella)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  useEffect(() => {
    if (step === "review") return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && step !== "ventajon" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, onClose])

  const readFile = async (file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    let parsed: CsvExpense[] = []
    try {
      parsed = parseRevolutExpenses(await file.text())
    } catch {
      parsed = []
    }
    if (parsed.length === 0) {
      setUploadError(
        "No he encontrado gastos en ese archivo. Descarga el extracto en Revolut: Perfil > Extractos > Excel/CSV."
      )
      return
    }
    setRows(parsed)
    const list = monthsInCsv(parsed)
    setMonth(list.some((m) => m.month === viewMonth) ? viewMonth : list[0].month)
    setStep("month")
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void readFile(e.dataTransfer.files?.[0])
  }

  const startReview = async () => {
    let q = buildImportQueue(rows, month, budget.expenses, budget.memory)
    setWarning(null)
    setDecisions([])
    const vMonths = ventajonMonths(q)
    if (vMonths.length > 0) {
      setStep("ventajon")
      try {
        const purchases = await fetchVentajonPurchases(vMonths)
        q = applyVentajon(q, purchases, budget.memory)
      } catch (e) {
        setWarning(`No se pudo consultar Ventajón: ${(e as Error).message}; se quedan como «Ventajon».`)
      }
    }
    setQueue(q)
    setStep("review")
  }

  const finish = (d: Decision[]) => {
    setDecisions(d)
    setStep("summary")
  }

  const exit = (d: Decision[]) => onClose(savedCount(d) > 0 ? month : undefined)

  const saved = decisions.filter((d) => d.choice !== SKIP)
  const total = saved.reduce((a, d) => a + d.amount, 0)
  const selected = months.find((m) => m.month === month)

  const titles: Record<Step, string> = {
    upload: "Importar de Revolut",
    month: "¿Qué mes importas?",
    ventajon: "Importar de Revolut",
    review: "Revisar gastos",
    summary: "Importación terminada",
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && (step === "upload" || step === "month") && onClose()}
    >
      <div
        role="dialog"
        aria-label="Importar CSV de Revolut"
        className="glass-panel fade-up max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
      >
        {step !== "review" && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{titles[step]}</h2>
            {step !== "ventajon" && (
              <button
                type="button"
                onClick={() => onClose()}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {step === "upload" && (
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging ? "border-cyan-400/70 bg-cyan-400/10" : "border-white/15 hover:border-cyan-400/50 hover:bg-white/[0.03]"
              }`}
            >
              <FileUp className="h-9 w-9 text-cyan-300" />
              <span className="text-base font-medium">Elige tu archivo .csv</span>
              <span className="text-sm text-white/60">o arrástralo aquí</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                void readFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            {uploadError && <p className="mt-3 text-sm text-red-300">{uploadError}</p>}
            <p className="mt-4 text-xs leading-relaxed text-white/60">
              En Revolut: Perfil &gt; Extractos &gt; Excel/CSV. Te iré preguntando la categoría de cada gasto del mes que elijas.
            </p>
          </div>
        )}

        {step === "month" && (
          <div>
            <ul className="-mx-1 max-h-[50dvh] space-y-1.5 overflow-y-auto px-1" role="radiogroup" aria-label="Mes">
              {months.map((m) => {
                const active = m.month === month
                return (
                  <li key={m.month}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMonth(m.month)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-cyan-400/60 bg-cyan-400/12"
                          : "border-white/[0.08] bg-white/[0.025] hover:border-white/20"
                      }`}
                    >
                      <span className="font-medium first-letter:uppercase">{monthLabel(m.month)}</span>
                      <span className="text-xs tabular-nums text-white/60">
                        {m.count} gastos · {fmt(m.total)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="rounded-xl border border-white/20 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                Otro archivo
              </button>
              <button
                type="button"
                onClick={() => void startReview()}
                className="liquid-button ml-auto flex-1 rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a] sm:flex-none"
              >
                Revisar {selected?.count ?? 0} gastos
              </button>
            </div>
          </div>
        )}

        {step === "ventajon" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-cyan-300" />
            <p className="text-base text-white/80">Buscando los comercios en Ventajón…</p>
          </div>
        )}

        {step === "review" && queue.length > 0 && (
          <ImportReview key={month} queue={queue} warning={warning} budget={budget} onFinish={finish} onExit={exit} />
        )}

        {step === "summary" && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-300" />
            <p className="mt-4 text-5xl font-bold tabular-nums tracking-tight">{fmt(total)}</p>
            <p className="mt-2 text-base text-white/70">
              {saved.length} {saved.length === 1 ? "gasto guardado" : "gastos guardados"}
            </p>
            <p className="mt-0.5 text-sm text-white/60">
              {decisions.length - saved.length} {decisions.length - saved.length === 1 ? "omitido" : "omitidos"}
            </p>
            <div className="mt-7 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("month")}
                className="rounded-xl border border-white/20 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.1] hover:text-white"
              >
                Importar otro mes
              </button>
              <button
                type="button"
                onClick={() => exit(decisions)}
                className="liquid-button ml-auto flex-1 rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a] sm:flex-none sm:min-w-[9rem]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
