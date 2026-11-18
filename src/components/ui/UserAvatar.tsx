import { useRef, ChangeEvent, useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { compressImage } from "../../utils/imageUtils"

interface UserAvatarProps {
  photoUrl: string | null
  email: string | null
  size?: "sm" | "md" | "lg"
  editable?: boolean
  onPhotoUploaded?: (base64Url: string) => Promise<boolean>
}

export const UserAvatar = ({
  photoUrl,
  email,
  size = "md",
  editable = true,
  onPhotoUploaded,
}: UserAvatarProps) => {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initial = email ? email.charAt(0).toUpperCase() : "A"

  const sizeClasses = {
    sm: "w-7 h-7 text-[11px]",
    md: "w-8 h-8 text-xs",
    lg: "w-12 h-12 text-base",
  }[size]

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onPhotoUploaded) return

    setUploading(true)
    try {
      // Comprimir avatar a 300px max para que sea ultraligero (< 30 KB)
      const base64 = await compressImage(file, 300, 0.8)
      await onPhotoUploaded(base64)
    } catch (err) {
      console.error("Error al procesar foto de perfil:", err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="relative group inline-block">
      {editable && onPhotoUploaded && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          title="Cambiar foto de perfil"
        />
      )}

      <div
        onClick={() => editable && onPhotoUploaded && fileInputRef.current?.click()}
        className={`${sizeClasses} rounded-full overflow-hidden shrink-0 border border-white/10 flex items-center justify-center transition-all ${
          editable ? "cursor-pointer hover:border-cyan-400 group-hover:scale-105" : ""
        } ${photoUrl ? "bg-slate-900" : "bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 font-bold shadow-md"}`}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        ) : photoUrl ? (
          <img
            src={photoUrl}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {editable && onPhotoUploaded && !uploading && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none"
        >
          <Camera className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>
  )
}
