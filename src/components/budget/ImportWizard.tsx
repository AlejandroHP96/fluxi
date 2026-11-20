import { useEffect, useRef, useState, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { X, FileUp, Loader2, CheckCircle2 } from "lucide-react"
import { fmt } from "../../utils/formatters"
import { monthLabel, toDateKey } from "../../utils/month"
import { monthsInCsv, parseRevolutExpenses, type CsvExpense } from "../../utils/revolutCsv"
import { applyVentajon, buildImportQueue, SKIP, ventajonMonths, type ImportItem } from "../../utils/importQueue"
import { fetchVentajonPurchases } from "../../utils/ventajonClient"
import { bankSessionValid, disconnectBank, fetchBankExpenses, startBankConnection } from "../../utils/bankClient"
import type { BudgetApi } from "../../hooks/useBudget"
import { ImportReview, type Decision } from "./ImportReview"

interface ImportWizardProps {
  budget: BudgetApi
  viewMonth: string // mes que se está viendo en el dashboard
  onManageCategories: () => void
  onClose: (importedMonth?: string) => void // con mes si se guardó algo, para saltar a él
}

type Step = "upload" | "month" | "ventajon" | "review" | "summary"

export const ImportWizard = ({ budget, viewMonth, onManageCategories, onClose }: ImportWizardProps) => {
  const [step, setStep] = useState<Step>("upload")
  const [rows, setRows] = useState<CsvExpense[]>([])
  const [month, setMonth] = useState("")
  const [queue, setQueue] = useState<ImportItem[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState<string | null>(null)
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

  // Común para CSV y banco: deja los gastos listos y pasa a elegir mes
  const applyRows = (parsed: CsvExpense[]) => {
    setRows(parsed)
    const list = monthsInCsv(parsed)
    setMonth(list.some((m) => m.month === viewMonth) ? viewMonth : list[0].month)
    setStep("month")
  }

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
    applyRows(parsed)
  }

  const bringFromBank = async () => {
    if (!budget.bank) return
    setBankError(null)
    setBankLoading(true)
    try {
      const dateFrom = toDateKey(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      const parsed = await fetchBankExpenses(budget.bank, dateFrom)
      if (parsed.length === 0) {
        setBankError("No hay gastos en los últimos 90 días")
        return
      }
      applyRows(parsed)
    } catch (e) {
      setBankError((e as Error).message)
    } finally {
      setBankLoading(false)
    }
  }

  const connectBank = async () => {
    setBankError(null)
    setBankLoading(true)
    try {
      // Si sale bien, la página navega al banco y no vuelve aquí
      await startBankConnection()
    } catch (e) {
      setBankError((e as Error).message)
      setBankLoading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void readFile(e.dataTransfer.files?.[0])
  }

  const startReview = async () => {
    let q = buildImportQueue(rows, month, budget.expenses, budget.memory, budget.categories)
    setWarning(null)
    setDecisions([])
    const vMonths = ventajonMonths(q)
    if (vMonths.length > 0) {
      setStep("ventajon")
      try {
        const purchases = await fetchVentajonPurchases(vMonths)
        q = applyVentajon(q, purchases, budget.memory, budget.categories)
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

        {budget.categories.every((c) => c.savings) && (
          <div className="py-4 text-center">
            <p className="text-base text-white/85">Antes de importar necesitas al menos una categoría de gasto.</p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onManageCategories()
              }}
              className="liquid-button mt-5 w-full rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a]"
            >
              Crear categorías
            </button>
          </div>
        )}

        {step === "upload" && !budget.categories.every((c) => c.savings) && (
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

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="mb-3 text-sm font-medium text-white/80">O tráelo directamente del banco</p>
              {bankSessionValid(budget.bank) ? (
                <>
                  <button
                    type="button"
                    disabled={bankLoading}
                    onClick={() => void bringFromBank()}
                    className="liquid-button w-full rounded-xl px-5 py-3.5 text-base font-semibold text-[#04202a] disabled:opacity-60"
                  >
                    {bankLoading ? "Trayendo movimientos…" : `Traer movimientos de ${budget.bank.bankName}`}
                  </button>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <p className="text-xs text-white/60">
                      {budget.bank.validUntil ? `Conexión válida hasta ${new Date(budget.bank.validUntil).toLocaleDateString("es-ES")}` : "Banco conectado"}
                    </p>
                    <button
                      type="button"
                      onClick={async () => { if (budget.bank) await disconnectBank(budget.bank); void budget.saveBank(null) }}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      Desconectar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={bankLoading}
                    onClick={() => void connectBank()}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-base font-semibold text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
                  >
                    {bankLoading ? "Abriendo el banco…" : "Conectar Revolut"}
                  </button>
                  {budget.bank && !bankSessionValid(budget.bank) && (
                    <p className="mt-2.5 text-xs text-white/60">La conexión caducó, vuelve a autorizar.</p>
                  )}
                </>
              )}
              {bankError && <p className="mt-3 text-sm text-red-300">{bankError}</p>}
            </div>
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
