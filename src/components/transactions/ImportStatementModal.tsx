import { useState, useRef, ChangeEvent } from "react"
import { FileSpreadsheet, FileText, Loader2, Upload, Check, AlertCircle, X } from "lucide-react"
import { parseRevolutCsv } from "../../utils/statementParser"
import type { NewTransaction } from "../../types"

interface ImportStatementModalProps {
  onClose: () => void
  onImport: (txs: NewTransaction[]) => Promise<number>
}

export const ImportStatementModal = ({ onClose, onImport }: ImportStatementModalProps) => {
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewTxs, setPreviewTxs] = useState<NewTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [successCount, setSuccessCount] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

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
        // Parseo instantáneo y privado en cliente
        const text = await file.text()
        const parsed = parseRevolutCsv(text)
        if (parsed.length === 0) {
          throw new Error("No se encontraron transacciones válidas en el archivo CSV")
        }
        setPreviewTxs(parsed)
      } else if (isPdf) {
        // Parseo mediante Vercel Serverless + Gemini 3.1 Flash Lite
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

  const handleConfirmImport = async () => {
    if (previewTxs.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const count = await onImport(previewTxs)
      if (count > 0) {
        setSuccessCount(count)
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        throw new Error("No se pudieron guardar las transacciones")
      }
    } catch (err: any) {
      setError(err.message || "Error al importar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-7 w-full max-w-lg my-auto max-h-[90vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" />
            <h3 className="text-base font-semibold">Importar extracto de Revolut</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">×</button>
        </div>

        {/* Zona de subida */}
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
            className="w-full py-6 px-4 rounded-xl border border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-2 transition-colors bg-surface/40 hover:bg-surface/70"
          >
            {parsing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs text-text font-medium">Analizando extracto {fileName}...</span>
              </>
            ) : (
              <>
                <div className="flex gap-2 text-accent">
                  <FileSpreadsheet className="w-5 h-5" />
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-text">Selecciona tu extracto (.CSV o .PDF)</div>
                <div className="text-[11px] text-muted text-center max-w-xs">
                  Revolut: Perfil &gt; Extractos &gt; Descargar como Excel/CSV o PDF
                </div>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-expense/10 border border-expense/20 flex items-center gap-2 text-xs text-expense">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="mb-4 p-3 rounded-lg bg-income/10 border border-income/20 flex items-center gap-2 text-xs text-income font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>¡Importadas {successCount} transacciones correctamente!</span>
          </div>
        )}

        {/* Vista previa de transacciones detectadas */}
        {previewTxs.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-semibold text-text">Vista previa ({previewTxs.length} movimientos)</span>
              <span className="text-muted text-[11px]">Revisa antes de confirmar</span>
            </div>

            <div className="overflow-y-auto max-h-56 border border-border rounded-lg divide-y divide-border/50 bg-surface/30">
              {previewTxs.map((tx, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-surface/50">
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-text truncate">{tx.description}</div>
                    <div className="text-[10px] text-muted flex gap-2">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span>{tx.category}</span>
                    </div>
                  </div>
                  <div className={`font-mono font-bold shrink-0 ${tx.amount > 0 ? "text-income" : "text-expense"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)} €
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={saving}
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-bold bg-accent text-black hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando {previewTxs.length} movimientos...</span>
                </>
              ) : (
                <span>Confirmar e importar {previewTxs.length} movimientos</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
