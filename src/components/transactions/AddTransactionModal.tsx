import { useState, useRef, ChangeEvent } from "react"
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react"
import { CATEGORIES } from "../../constants/categories"
import { compressImage } from "../../utils/imageUtils"
import type { NewTransaction, TransactionType } from "../../types"

interface FormState {
  description: string
  amount: string
  category: string
  type: TransactionType
  date: string
}

const EMPTY: FormState = {
  description: "",
  amount: "",
  category: "Alimentación",
  type: "expense",
  date: new Date().toISOString().split("T")[0],
}

interface AddTransactionModalProps {
  onClose: () => void
  onAdd: (tx: NewTransaction) => Promise<boolean>
}

const AddTransactionModal = ({ onClose, onAdd }: AddTransactionModalProps) => {
  const [form, setForm]         = useState<FormState>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [scanning, setScanning] = useState(false)
  const [err, setErr]           = useState("")

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    setErr("")

    try {
      const base64DataUrl = await compressImage(file, 900, 0.65)

      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64DataUrl,
          mimeType: "image/jpeg",
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Fallo al escanear ticket")
      }

      const { data } = await res.json()

      setForm((prev) => ({
        ...prev,
        type: "expense",
        amount: data.amount ? String(data.amount) : prev.amount,
        description: data.description || prev.description,
        date: data.date || prev.date,
        category: data.category && CATEGORIES.includes(data.category) ? data.category : prev.category,
      }))
    } catch (error: any) {
      setErr(error.message || "No se pudo leer el ticket")
    } finally {
      setScanning(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ""
      if (galleryInputRef.current) galleryInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    if (!form.description.trim() || !form.amount) {
      setErr("Descripción e importe son obligatorios."); return
    }
    setSaving(true)
    const ok = await onAdd({
      description: form.description.trim(),
      amount: form.type === "expense"
        ? -Math.abs(parseFloat(form.amount))
        : Math.abs(parseFloat(form.amount)),
      category: form.type === "income" ? "Ingresos" : form.category,
      type: form.type,
      date: form.date,
    })
    setSaving(false)
    if (ok) onClose()
    else setErr("Error al guardar. Inténtalo de nuevo.")
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-7 w-full max-w-sm my-auto max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-white">Nueva transacción</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors">
            ×
          </button>
        </div>

        {/* Botones de escanear (Cámara y Galería) */}
        {form.type === "expense" && (
          <div className="mb-5 space-y-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleCapture}
              className="hidden"
            />

            {scanning ? (
              <div className="w-full py-3 px-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Leyendo ticket con IA...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2.5 px-2 rounded-xl border border-white/10 hover:border-cyan-500/40 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-all bg-white/[0.03] hover:bg-white/[0.07]"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Hacer foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-2.5 px-2 rounded-xl border border-white/10 hover:border-cyan-500/40 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-all bg-white/[0.03] hover:bg-white/[0.07]"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Galería</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-5 p-1 rounded-xl bg-white/[0.03] border border-white/5">
          {(["expense", "income"] as TransactionType[]).map((t) => (
            <button key={t} onClick={() => set("type", t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                form.type === t
                  ? t === "income" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "text-white/40 hover:text-white"
              }`}>
              {t === "income" ? "💰 Ingreso" : "💸 Gasto"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Descripción</label>
            <input
              type="text"
              placeholder="Ej: Mercadona"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Importe (€)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-white/50 mb-1.5">Fecha</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white transition-colors"
            />
          </div>

          {form.type === "expense" && (
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {err && <p className="text-rose-400 text-xs mt-3">{err}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving || scanning}
          className="mt-6 w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Añadir transacción"}
        </button>
      </div>
    </div>
  )
}

export default AddTransactionModal
