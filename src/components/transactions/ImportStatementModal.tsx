import { useState, useRef, ChangeEvent } from "react"
import { FileSpreadsheet, FileText, Loader2, Upload, Check, AlertCircle, Sparkles, ArrowRight, RefreshCw } from "lucide-react"
import { auth } from "../../lib/firebase"
import { parseRevolutStatement, type RevolutStatement } from "../../utils/statementParser"
import { filterNew, isOwnTransfer, ownTransferKind } from "../../utils/finance"
import type { FinanceApi } from "../../hooks/useFinance"
import type { Transaction, NewTransaction, NewTransfer } from "../../types"

interface ImportStatementModalProps {
  onClose: () => void
  onImport: (txs: NewTransaction[]) => Promise<number>
  onUpdateBatch?: (updates: Array<{ id: string; description: string; category: string }>) => Promise<number>
  existingTransactions?: Transaction[]
  // Finanzas: traspasos, saldos de las cuentas y nombres de tus otras cuentas
  finance?: Pick<FinanceApi, "transfers" | "settings" | "addTransfers" | "upsertRevolutBalance" | "moveTransactionsToTransfers">
}

type Step = "upload_statement" | "ask_ventajon" | "upload_ventajon" | "pick_month" | "done"

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

// Distancia en días entre la fecha del movimiento y un "DD.MM" de Ventajón del año indicado
const dayDiffToShortDate = (txDay: Date, dateShort: string, year: number): number => {
  const m = String(dateShort).match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!m) return Infinity
  return Math.abs(txDay.getTime() - Date.UTC(year, +m[2] - 1, +m[1])) / DAY_MS
}

export const ImportStatementModal = ({
  onClose,
  onImport,
  onUpdateBatch,
  existingTransactions = [],
  finance,
}: ImportStatementModalProps) => {
  const [step, setStep] = useState<Step>("upload_statement")
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewTxs, setPreviewTxs] = useState<NewTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [successCount, setSuccessCount] = useState<number | null>(null)
  // Lo que se guarda en Finanzas al confirmar (solo CSV) y lo que se omite por estar ya importado
  const [skippedCount, setSkippedCount] = useState(0)
  const [pendingTransfers, setPendingTransfers] = useState<NewTransfer[]>([])
  const [pendingBalances, setPendingBalances] = useState<RevolutStatement["balances"]>({})
  const [toMove, setToMove] = useState<Transaction[]>([])
  const [transferCount, setTransferCount] = useState(0)
  const [ventajonCount, setVentajonCount] = useState<number>(0)
  const [updatedVentajonCount, setUpdatedVentajonCount] = useState<number | null>(null)
  const [pendingVentajonCount, setPendingVentajonCount] = useState(0)
  const [pendingItems, setPendingItems] = useState<any[] | null>(null)
  const [pickedMonth, setPickedMonth] = useState("") // "YYYY-MM"
  const [ventajonSource, setVentajonSource] = useState<"pdf" | "sync">("pdf")
  // Por qué no casa cada pago pendiente, agrupado (se muestra al final)
  const [pendingReasons, setPendingReasons] = useState<Array<{ label: string; count: number; months: string[] }>>([])
  const [itemsRange, setItemsRange] = useState<string>("")

  const existingVentajonCount = existingTransactions.filter((t) => isVentajon(t.description)).length

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
    setSkippedCount(0)
    setPendingTransfers([])
    setPendingBalances({})
    setToMove([])

    try {
      const isPdf = file.name.endsWith(".pdf") || file.type === "application/pdf"
      const isCsv = file.name.endsWith(".csv") || file.type === "text/csv"

      if (isCsv) {
        const text = await file.text()
        const names = finance?.settings.ownTransferNames ?? []
        const parsed = parseRevolutStatement(text, names)
        if (parsed.transactions.length === 0 && parsed.transfers.length === 0) {
          throw new Error("No se encontraron transacciones válidas en el archivo CSV")
        }
        // Transferencias con tus otras cuentas que se importaron antes como transacciones: pasan a traspasos
        const moving = existingTransactions.filter((t) => isOwnTransfer(t.description, names))
        const newTxs = filterNew(parsed.transactions, existingTransactions)
        const newTransfers = filterNew(parsed.transfers, [...(finance?.transfers ?? []), ...moving])
        setPreviewTxs(newTxs)
        setSkippedCount(parsed.transactions.length - newTxs.length)
        setPendingTransfers(newTransfers)
        setPendingBalances(parsed.balances)
        setToMove(moving)
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
        const newTxs = filterNew(transactions as NewTransaction[], existingTransactions)
        setPreviewTxs(newTxs)
        setSkippedCount(transactions.length - newTxs.length)
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
  const hasBalances = Boolean(pendingBalances.current || pendingBalances.savings)
  const hasWork = previewTxs.length > 0 || pendingTransfers.length > 0 || toMove.length > 0 || hasBalances

  const handleConfirmImport = async () => {
    if (!hasWork) return
    setSaving(true)
    setError(null)

    try {
      let count = 0
      if (previewTxs.length > 0) {
        count = await onImport(previewTxs)
        if (count === 0) throw new Error("No se pudieron guardar las transacciones")
      }

      // Si algo de Finanzas falla, se puede reimportar el mismo CSV: lo ya guardado se omite
      let saved = 0
      if (finance && toMove.length > 0) {
        const moved = await finance.moveTransactionsToTransfers(toMove.map((tx) => ({ tx, kind: ownTransferKind(Number(tx.amount)) })))
        if (moved === 0) throw new Error("No se pudieron mover los traspasos entre tus cuentas")
        saved += moved
      }
      if (finance && pendingTransfers.length > 0) {
        const added = await finance.addTransfers(pendingTransfers)
        if (added === 0) throw new Error("No se pudieron guardar los movimientos de ahorro")
        saved += added
      }
      if (finance && pendingBalances.current) {
        await finance.upsertRevolutBalance("revolut_current", pendingBalances.current.balance, pendingBalances.current.date)
      }
      if (finance && pendingBalances.savings) {
        await finance.upsertRevolutBalance("revolut_savings", pendingBalances.savings.balance, pendingBalances.savings.date)
      }
      setTransferCount(saved)
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
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fallo al procesar el PDF de Ventajón")
      }

      const { items, period } = await res.json()
      if (!items || items.length === 0) {
        throw new Error("No se encontraron compras en el extracto de Ventajón")
      }

      if (!period) {
        // Ni cabecera ni nombre de archivo indican el mes: se le pregunta al usuario
        setPendingItems(items)
        setPickedMonth("")
        setStep("pick_month")
        return
      }
      setVentajonSource("pdf")
      await matchAndSave(withYear(items, period))
    } catch (err: any) {
      setError(err?.message || "Error al leer el extracto de Ventajón")
    } finally {
      setParsing(false)
      if (ventajonFileInputRef.current) ventajonFileInputRef.current.value = ""
    }
  }

  const handleConfirmMonth = async () => {
    const m = pickedMonth.match(/^(\d{4})-(\d{2})$/)
    if (!m || !pendingItems) return
    setParsing(true)
    setError(null)
    try {
      setVentajonSource("pdf")
      await matchAndSave(withYear(pendingItems, { year: +m[1], month: +m[2] }))
      setPendingItems(null)
    } catch (err: any) {
      setError(err?.message || "Error al emparejar el extracto de Ventajón")
    } finally {
      setParsing(false)
    }
  }

  // Sincroniza con la web de Ventajón (api/ventajon-sync): pide los meses de los pagos sin desglosar
  const handleVentajonSync = async () => {
    setParsing(true)
    setError(null)
    try {
      const months = new Set<string>()
      for (const t of existingTransactions) {
        if (!isVentajon(t.description)) continue
        const day = parseTxDay(t.date)
        if (!day) continue
        // También los meses vecinos, por si la compra cae a final o principio de mes
        for (const offset of [-MAX_DAY_DIFF, 0, MAX_DAY_DIFF]) {
          months.add(new Date(day.getTime() + offset * DAY_MS).toISOString().slice(0, 7))
        }
      }
      if (months.size === 0) throw new Error("No hay pagos de Ventajon pendientes de desglosar")

      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error("Inicia sesión para sincronizar con Ventajón")

      const res = await fetch("/api/ventajon-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ months: [...months].sort() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fallo al sincronizar con Ventajón")
      }

      const { items } = await res.json()
      // "2026-10-31T13:30:44.149" -> mismo formato que el PDF ("31.10") más el año
      const mapped = (items as Array<{ date: string }>).map((it) => {
        const [y, m, d] = it.date.slice(0, 10).split("-")
        return { ...it, dateShort: `${d}.${m}`, year: +y }
      })
      setVentajonSource("sync")
      await matchAndSave(mapped)
    } catch (err: any) {
      setError(err?.message || "Error al sincronizar con Ventajón")
    } finally {
      setParsing(false)
    }
  }

  // El extracto de un mes trae compras de ese mes y del anterior: un mes posterior al del
  // extracto solo puede ser del año anterior (p. ej. diciembre en el extracto de enero).
  const withYear = (rawItems: any[], period: { year: number; month: number }) =>
    rawItems.map((it) => {
      const month = Number(String(it.dateShort).split(".")[1])
      return { ...it, year: month <= period.month ? period.year : period.year - 1 }
    })

  // Empareja las compras de Ventajón (PDF o API) con los pagos "Ventajon" guardados y guarda el comercio real
  const matchAndSave = async (items: any[]) => {
    // existingTransactions llega por props desde el onSnapshot de App.tsx, que ya incluye
    // los movimientos recién importados (Firestore emite primero las escrituras locales).
    const ventajonTxs = existingTransactions.filter((t) => isVentajon(t.description))

    const usedItems = new Set<number>()
    const updates: Array<{ id: string; description: string; category: string }> = []
    const unmatched: Transaction[] = []

    for (const tx of ventajonTxs) {
      const txAmt = Math.abs(Number(tx.amount))
      const txDay = parseTxDay(tx.date)
      if (!txDay) {
        unmatched.push(tx)
        continue
      }

      // Mismo importe y fecha más cercana (Revolut puede usar la fecha de liquidación,
      // uno o varios días después de la compra en Ventajón).
      let bestIdx = -1
      let bestDiff = Infinity
      items.forEach((it: any, idx: number) => {
        if (usedItems.has(idx) || Math.abs(Number(it.amount) - txAmt) >= 0.01) return
        const diff = dayDiffToShortDate(txDay, it.dateShort, it.year)
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
        unmatched.push(tx)
      }
    }

    // Motivo de cada pago sin pareja
    const itemMonth = (it: any) => `${it.year}-${String(it.dateShort).split(".")[1]?.padStart(2, "0")}`
    const itemMonths = new Set(items.map(itemMonth))
    const reasons = new Map<string, Set<string>>()
    const counts = new Map<string, number>()
    for (const tx of unmatched) {
      const txDay = parseTxDay(tx.date)
      const month = txDay ? txDay.toISOString().slice(0, 7) : "?"
      const txAmt = Math.abs(Number(tx.amount))
      let label: string
      if (!txDay) {
        label = "Fecha que no se puede leer"
      } else if (!itemMonths.has(month)) {
        label = "Ventajón no tiene compras de ese mes"
      } else if (Number(tx.amount) > 0) {
        label = "Es un ingreso o devolución, no una compra"
      } else {
        let nearest = Infinity
        items.forEach((it: any) => {
          if (Math.abs(Number(it.amount) - txAmt) < 0.01) {
            nearest = Math.min(nearest, dayDiffToShortDate(txDay, it.dateShort, it.year))
          }
        })
        label =
          nearest <= MAX_DAY_DIFF
            ? "La compra ya se emparejó con otro pago igual (posible duplicado)"
            : nearest <= 31
              ? "Hay una compra con ese importe, pero a más de 3 días"
              : "No hay ninguna compra en Ventajón con ese importe"
      }
      if (!reasons.has(label)) reasons.set(label, new Set())
      reasons.get(label)!.add(month)
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    setPendingReasons(
      [...reasons].map(([label, months]) => ({ label, count: counts.get(label) || 0, months: [...months].sort() }))
        .sort((a, b) => b.count - a.count)
    )
    const sortedItemMonths = [...itemMonths].sort()
    setItemsRange(
      items.length ? `${items.length} compras de Ventajón (${sortedItemMonths[0]} → ${sortedItemMonths[sortedItemMonths.length - 1]})` : ""
    )

    if (unmatched.length > 0) {
      console.warn(
        `[Ventajón] ${ventajonTxs.length} movimientos, ${updates.length} emparejados, ${unmatched.length} sin pareja`,
        { unmatched: unmatched.slice(0, 20).map((t) => ({ date: t.date, amount: t.amount })), items: items.slice(0, 10) }
      )
    }

    if (updates.length > 0 && onUpdateBatch) {
      const count = await onUpdateBatch(updates)
      if (count === 0) {
        throw new Error(`Se emparejaron ${updates.length} pagos, pero no se pudieron guardar los cambios`)
      }
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
              {step === "ask_ventajon" || step === "upload_ventajon" || step === "pick_month" ? (
                <Sparkles className="w-4 h-4 text-amber-400" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {step === "ask_ventajon" || step === "upload_ventajon" || step === "pick_month"
                  ? "Desglose Ventajón"
                  : "Importar extracto"}
              </h3>
              <p className="text-[11px] text-white/40">
                {step === "ask_ventajon" || step === "upload_ventajon" || step === "pick_month"
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

            {/* Acceso directo: desglosar pagos ya importados sin subir otro extracto */}
            {!hasWork && skippedCount === 0 && !parsing && existingVentajonCount > 0 && (
              <button
                type="button"
                onClick={() => setStep("upload_ventajon")}
                className="mb-4 w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-400/50 flex items-center justify-between gap-2 text-xs text-amber-200 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  Desglosar Ventajón: {existingVentajonCount} pagos sin comercio
                </span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!parsing && (hasWork || skippedCount > 0) && (
              <div className="flex-1 overflow-hidden flex flex-col mb-4">
                <ul className="mb-2 px-1 space-y-1 text-xs text-white/60">
                  <li>
                    <span className="font-semibold text-white">{previewTxs.length}</span> transacciones nuevas
                  </li>
                  {skippedCount > 0 && (
                    <li className="text-white/40">{skippedCount} ya estaban importadas (se omiten)</li>
                  )}
                  {pendingTransfers.length > 0 && (
                    <li className="text-cyan-300/80">
                      {pendingTransfers.length} movimientos de ahorro, intereses y traspasos van a Finanzas
                    </li>
                  )}
                  {toMove.length > 0 && (
                    <li className="text-cyan-300/80">
                      {toMove.length} transferencias entre tus cuentas salen de Transacciones
                    </li>
                  )}
                  {hasBalances && (
                    <li className="text-white/40">
                      Saldo:{" "}
                      {pendingBalances.current && <>Conjunta {pendingBalances.current.balance.toFixed(2)} €</>}
                      {pendingBalances.current && pendingBalances.savings && " · "}
                      {pendingBalances.savings && <>Ahorros {pendingBalances.savings.balance.toFixed(2)} €</>}
                    </li>
                  )}
                </ul>

                {previewTxs.length > 0 && (
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
                )}
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
                disabled={!hasWork || saving}
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
                    <span>{previewTxs.length > 0 ? `Importar ${previewTxs.length} transacciones` : "Guardar en Finanzas"}</span>
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
                Podemos reemplazar &quot;Ventajon&quot; por el comercio real (Mercadona,
                McDonald&apos;s, IKEA...) y categorizarlos al instante, sincronizando con tu cuenta
                de Ventajón o subiendo el extracto en PDF.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("upload_ventajon")}
                className="liquid-button w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-950 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Sí, desglosar ahora</span>
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
            <button
              type="button"
              onClick={handleVentajonSync}
              disabled={parsing}
              className="liquid-button w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{parsing ? "Sincronizando con Ventajón..." : "Sincronizar con Ventajón"}</span>
            </button>
            <p className="text-center text-[11px] text-white/40">o sube el extracto en PDF</p>

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

        {/* PASO 3b: El PDF no indica su mes (ni cabecera ni nombre de archivo) */}
        {step === "pick_month" && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              <p className="font-semibold text-sm mb-1 text-amber-300">¿De qué mes es este extracto?</p>
              <p className="text-white/70 leading-relaxed">
                No hemos podido leer el mes en el PDF. Indica el que aparece en el título del
                extracto (por ejemplo, noviembre de 2026 para &quot;Noviembre&apos;26&quot;) para
                emparejar cada compra con el año correcto.
              </p>
            </div>

            <input
              type="month"
              value={pickedMonth}
              onChange={(e) => setPickedMonth(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 focus:border-amber-400/60 outline-none text-sm text-white [color-scheme:dark]"
            />

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={parsing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMonth}
                disabled={!pickedMonth || parsing}
                className="liquid-button px-5 py-2 rounded-xl text-xs font-bold text-slate-950 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Emparejar</span>
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
              {successCount !== null && successCount > 0 && (
                <p className="text-xs text-white/60 mt-0.5">
                  Se importaron {successCount} transacciones correctamente.
                </p>
              )}
              {transferCount > 0 && (
                <p className="text-xs text-white/60 mt-0.5">
                  Se guardaron {transferCount} movimientos de ahorro y traspasos en Finanzas.
                </p>
              )}
              {updatedVentajonCount !== null && (
                <p className="text-xs text-cyan-300 mt-1">
                  Se desglosaron {updatedVentajonCount} comercios reales de Ventajón.
                </p>
              )}
              {pendingVentajonCount > 0 && (
                <p className="text-[11px] text-white/50 mt-1 max-w-xs">
                  {ventajonSource === "sync"
                    ? `${pendingVentajonCount} pagos de Ventajon siguen sin comercio: no hay una compra en Ventajón con el mismo importe y fecha.`
                    : `${pendingVentajonCount} pagos de Ventajon siguen sin comercio: no aparecen en ese PDF. Sube el extracto del mes siguiente cuando lo tengas.`}
                </p>
              )}
              {pendingVentajonCount > 0 && pendingReasons.length > 0 && (
                <ul className="mt-3 max-w-xs mx-auto text-left space-y-1.5 text-[11px] text-white/50">
                  {itemsRange && <li className="text-white/40">Recibidas: {itemsRange}</li>}
                  {pendingReasons.map((r) => (
                    <li key={r.label}>
                      <span className="font-semibold text-white/80">{r.count}</span> · {r.label}
                      <span className="text-white/30">
                        {" "}({r.months.length > 3 ? `${r.months[0]} → ${r.months[r.months.length - 1]}, ${r.months.length} meses` : r.months.join(", ")})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {pendingVentajonCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setStep("upload_ventajon")
                  }}
                  className="mt-4 px-4 py-2 rounded-xl border border-amber-500/30 hover:border-amber-400/60 bg-amber-500/[0.05] text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Subir otro PDF de Ventajón
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
