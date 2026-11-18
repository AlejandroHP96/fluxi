import { useState, useRef, ChangeEvent } from "react"
import { FileSpreadsheet, FileText, Loader2, Upload, Check, AlertCircle, Sparkles, ArrowRight } from "lucide-react"
import { parseRevolutCsv } from "../../utils/statementParser"
import type { Transaction, NewTransaction } from "../../types"

interface ImportStatementModalProps {
  onClose: () => void
  onImport: (txs: NewTransaction[]) => Promise<number>
  onUpdateBatch?: (updates: Array<{ id: string; description: string; category: string }>) => Promise<number>
  existingTransactions?: Transaction[]
}

type Step = "upload_statement" | "ask_ventajon" | "upload_ventajon" | "done"

const MAX_DAY_DIFF = 3
const DAY_MS = 24 * 60 * 60 * 1000

const isVentajon = (description: string) =>
  description.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes("ventajon")

// Acepta "YYYY-MM-DD[ HH:mm]" y "DD/MM/YYYY[ HH:mm]"; devuelve medianoche UTC del día
const parseTxDay = (date: string): Date | null => {
  const iso = date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))
  const eu = date.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (eu) return new Date(Date.UTC(+eu[3], +eu[2] - 1, +eu[1]))
  return null
}

// Distancia en días entre la fecha del movimiento y un "DD.MM" de Ventajón (sin año;
// se prueba el año del movimiento y los adyacentes por el cambio de año)
const dayDiffToShortDate = (txDay: Date, dateShort: string): number => {
  const m = String(dateShort).match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!m) return Infinity
  const year = txDay.getUTCFullYear()
  return Math.min(
    ...[year - 1, year, year + 1].map((y) =>
      Math.abs(txDay.getTime() - Date.UTC(y, +m[2] - 1, +m[1])) / DAY_MS
    )
  )
}

export const ImportStatementModal = ({
  onClose,
  onImport,
  onUpdateBatch,
  existingTransactions = [],
}: ImportStatementModalProps) => {
  const [step, setStep] = useState<Step>("upload_statement")
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewTxs, setPreviewTxs] = useState<NewTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const [ventajonCount, setVentajonCount] = useState<number>(0)
  const [updatedVentajonCount, setUpdatedVentajonCount] = useState<number | null>(null)
  const [pendingVentajonCount, setPendingVentajonCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const ventajonFileInputRef = useRef<HTMLInputElement>(null)

  // 1. Manejo del extracto inicial (CSV o PDF de Revolut)
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError(null)
    setFileName(file.name)
    setPreviewTxs([])
    setSuccessCount(null)

    try {
      const isPdf = file.name.endsWith(".pdf") || file.type === "application/pdf"
      const isCsv = file.name.endsWith(".csv") || file.type === "text/csv"

      if (isCsv) {
        const text = await file.text()
        const parsed = parseRevolutCsv(text)
        if (parsed.length === 0) {
          throw new Error("No se encontraron transacciones válidas en el archivo CSV")
        }
        setPreviewTxs(parsed)
      } else if (isPdf) {
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const base64 = await base64Promise
        const res = await fetch("/api/parse-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfBase64: base64 }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Fallo al procesar el PDF del extracto")
        }

        const { transactions } = await res.json()
        if (!transactions || transactions.length === 0) {
          throw new Error("No se detectaron transacciones en el PDF")
        }
        setPreviewTxs(transactions)
      } else {
        throw new Error("Por favor selecciona un archivo .csv o .pdf de Revolut")
      }
    } catch (err: any) {
      setError(err?.message || "Error al leer el archivo")
    } finally {
      setParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // 2. Confirmación de guardado de extracto principal
  const handleConfirmImport = async () => {
    if (previewTxs.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const count = await onImport(previewTxs)
      if (count > 0) {
        setSuccessCount(count)

        // Contar cuántos cargos son de "Ventajon" en este lote
        const vCount = previewTxs.filter((t) => isVentajon(t.description)).length

        // Comprobar si el usuario tiene desactivada la ayuda de Ventajón
        const ventajonDisabled = localStorage.getItem("fluxi_disable_ventajon") === "true"

        if (vCount > 0 && !ventajonDisabled) {
          setVentajonCount(vCount)
          setTimeout(() => {
            setStep("ask_ventajon")
            setSaving(false)
          }, 800)
        } else {
          setStep("done")
          setTimeout(() => {
            onClose()
          }, 1500)
        }
      } else {
        throw new Error("No se pudieron guardar las transacciones")
      }
    } catch (err: any) {
      setError(err.message || "Error al importar")
      setSaving(false)
    }
  }

  // 3. Procesar el PDF de Ventajón
  const handleVentajonFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError(null)

    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const base64 = await base64Promise
      const res = await fetch("/api/parse-ventajon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64 }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fallo al procesar el PDF de Ventajón")
      }

      const { items } = await res.json()
      if (!items || items.length === 0) {
        throw new Error("No se encontraron compras en el extracto de Ventajón")
      }

      // existingTransactions llega por props desde el onSnapshot de App.tsx, que ya incluye
      // los movimientos recién importados (Firestore emite primero las escrituras locales).
      const ventajonTxs = existingTransactions.filter((t) => isVentajon(t.description))

      const usedItems = new Set<number>()
      const updates: Array<{ id: string; description: string; category: string }> = []
      const unmatched: Array<{ date: string; amount: number }> = []

      for (const tx of ventajonTxs) {
        const txAmt = Math.abs(Number(tx.amount))
        const txDay = parseTxDay(tx.date)
        if (!txDay) {
          unmatched.push({ date: tx.date, amount: tx.amount })
          continue
        }

        // Mismo importe y fecha más cercana (Revolut puede usar la fecha de liquidación,
        // uno o varios días después de la compra en Ventajón).
        let bestIdx = -1
        let bestDiff = Infinity
        items.forEach((it: any, idx: number) => {
          if (usedItems.has(idx) || Math.abs(Number(it.amount) - txAmt) >= 0.01) return
          const diff = dayDiffToShortDate(txDay, it.dateShort)
          if (diff <= MAX_DAY_DIFF && diff < bestDiff) {
            bestDiff = diff
            bestIdx = idx
          }
        })

        if (bestIdx !== -1) {
          usedItems.add(bestIdx)
          const matchedItem = items[bestIdx]
          updates.push({
            id: tx.id,
            description: matchedItem.concept,
            category: matchedItem.category,
          })
        } else {
          unmatched.push({ date: tx.date, amount: tx.amount })
        }
      }

      if (unmatched.length > 0) {
        console.warn(
          `[Ventajón] ${ventajonTxs.length} movimientos, ${updates.length} emparejados, ${unmatched.length} sin pareja`,
          { unmatched: unmatched.slice(0, 10), items: items.slice(0, 10) }
        )
      }

      if (updates.length > 0 && onUpdateBatch) {
        const count = await onUpdateBatch(updates)
        setUpdatedVentajonCount(count)
      } else {
        setUpdatedVentajonCount(0)
      }

      setPendingVentajonCount(unmatched.length)
      setStep("done")
      // Si quedan pendientes no se cierra solo, para que dé tiempo a leer el aviso
      if (unmatched.length === 0) {
        setTimeout(() => {
          onClose()
        }, 2500)
      }
    } catch (err: any) {
      setError(err?.message || "Error al leer el extracto de Ventajón")
    } finally {
      setParsing(false)
      if (ventajonFileInputRef.current) ventajonFileInputRef.current.value = ""
    }
  }

  const handleDisableVentajon = () => {
    localStorage.setItem("fluxi_disable_ventajon", "true")
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-7 w-full max-w-lg my-auto max-h-[92vh] flex flex-col shadow-2xl">
        {/* Cabecera */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              {step === "ask_ventajon" || step === "upload_ventajon" ? (
                <Sparkles className="w-4 h-4 text-amber-400" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {step === "ask_ventajon" || step === "upload_ventajon"
                  ? "Desglose Ventajón"
                  : "Importar extracto"}
              </h3>
              <p className="text-[11px] text-white/40">
                {step === "ask_ventajon" || step === "upload_ventajon"
                  ? "Enlazar comercios reales con tus pagos"
                  : "Revolut (.CSV o .PDF)"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* PASO 1: Subir Extracto Principal */}
        {step === "upload_statement" && (
          <>
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .pdf, text/csv, application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing || saving}
                className="w-full py-7 px-4 rounded-2xl border border-dashed border-white/10 hover:border-cyan-500/40 flex flex-col items-center justify-center gap-2.5 transition-all bg-white/[0.02] hover:bg-white/[0.05]"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-xs text-white font-medium">Analizando {fileName}...</span>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 text-cyan-400">
                      <FileSpreadsheet className="w-6 h-6" />
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-semibold text-white">Arrastra o haz clic para subir</div>
                    <div className="text-[11px] text-white/40 text-center max-w-xs">
                      Revolut: Perfil &gt; Extractos &gt; Descargar como Excel/CSV o PDF
                    </div>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {previewTxs.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col mb-4">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs text-white/60">
                    {previewTxs.length} transacciones listas para importar
                  </span>
                  <span className="text-[11px] text-cyan-400 font-medium">
                    (Traspasos internos a ahorros excluidos)
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-white/5 rounded-xl p-2 bg-white/[0.01]">
                  {previewTxs.slice(0, 10).map((t, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-white/[0.02]">
                      <div className="truncate max-w-[200px]">
                        <span className="text-white font-medium">{t.description}</span>
                        <span className="text-white/30 text-[10px] ml-2">{t.date}</span>
                      </div>
                      <span className={`font-mono font-semibold ${t.type === "income" ? "text-emerald-400" : "text-white"}`}>
                        {t.type === "income" ? "+" : "-"}{Math.abs(t.amount).toFixed(2)} €
                      </span>
                    </div>
                  ))}
                  {previewTxs.length > 10 && (
                    <div className="text-center text-[11px] text-white/30 py-1">
                      ... y {previewTxs.length - 10} más
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-auto pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={previewTxs.length === 0 || saving}
                className="liquid-button px-5 py-2 rounded-xl text-xs font-bold text-slate-950 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Importar {previewTxs.length} transacciones</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* PASO 2: Pregunta guiada de Ventajón */}
        {step === "ask_ventajon" && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              <p className="font-semibold text-sm mb-1 text-amber-300">
                Se han detectado {ventajonCount} pagos de &quot;Ventajon&quot;
              </p>
              <p className="text-white/70 leading-relaxed">
                ¿Tienes a mano el extracto digital en PDF de Ventajón? Podemos reemplazar
                &quot;Ventajon&quot; por el comercio real (Mercadona, McDonald&apos;s, IKEA...) y
                categorizarlos al instante. Ojo: el extracto de cada mes recoge las compras del mes
                anterior (el de diciembre trae las de noviembre).
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("upload_ventajon")}
                className="liquid-button w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-950 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Sí, subir PDF de Ventajón ahora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all text-center"
              >
                No por ahora (terminar importación)
              </button>

              <button
                type="button"
                onClick={handleDisableVentajon}
                className="text-[11px] text-white/30 hover:text-white/50 text-center pt-1 underline"
              >
                No uso Ventajón (no volver a preguntar)
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Subir PDF de Ventajón */}
        {step === "upload_ventajon" && (
          <div className="space-y-4 py-2">
            <input
              ref={ventajonFileInputRef}
              type="file"
              accept=".pdf, application/pdf"
              onChange={handleVentajonFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => ventajonFileInputRef.current?.click()}
              disabled={parsing}
              className="w-full py-8 px-4 rounded-2xl border border-dashed border-amber-500/30 hover:border-amber-400/60 flex flex-col items-center justify-center gap-2.5 transition-all bg-amber-500/[0.03] hover:bg-amber-500/[0.07]"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                  <span className="text-xs text-white font-medium">Cruzando pagos con Ventajón...</span>
                </>
              ) : (
                <>
                  <FileText className="w-8 h-8 text-amber-400" />
                  <div className="text-xs font-semibold text-white">Selecciona tu extracto de Ventajón (.PDF)</div>
                  <div className="text-[11px] text-white/40 text-center max-w-xs">
                    Ejemplo: 2026_11_extracto_digital.pdf
                  </div>
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: Éxito final */}
        {step === "done" && (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">¡Proceso completado!</p>
              {successCount !== null && (
                <p className="text-xs text-white/60 mt-0.5">
                  Se importaron {successCount} transacciones correctamente.
                </p>
              )}
              {updatedVentajonCount !== null && (
                <p className="text-xs text-cyan-300 mt-1">
                  Se desglosaron {updatedVentajonCount} comercios reales de Ventajón.
                </p>
              )}
              {pendingVentajonCount > 0 && (
                <p className="text-[11px] text-white/50 mt-1 max-w-xs">
                  {pendingVentajonCount} pagos de Ventajon siguen sin comercio: no aparecen en ese PDF.
                  Sube el extracto del mes siguiente cuando lo tengas.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
