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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-7 w-full max-w-lg my-auto max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Importar extracto</h3>
              <p className="text-[11px] text-white/40">Revolut (.CSV o .PDF)</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors">
            ×
          </button>
        </div>

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

        {successCount !== null && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300 font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>¡Importadas {successCount} transacciones correctamente!</span>
          </div>
        )}

        {previewTxs.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-semibold text-white">Vista previa ({previewTxs.length} movimientos)</span>
              <span className="text-white/40 text-[11px]">Revisa antes de guardar</span>
            </div>

            <div className="overflow-y-auto max-h-56 border border-white/10 rounded-xl divide-y divide-white/5 bg-black/20">
              {previewTxs.map((tx, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-white truncate text-xs">{tx.description}</div>
                    <div className="text-[10px] text-white/40 flex gap-2 mt-0.5">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span className="text-white/60">{tx.category}</span>
                    </div>
                  </div>
                  <div className={`font-mono font-bold shrink-0 text-xs ${tx.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)} €
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={saving}
              className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {saving ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando {previewTxs.length} movimientos...</span>
                </div>
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
