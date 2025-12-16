import { Loader2 } from "lucide-react"
import Image from "next/image"

export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 gap-6">
      {/* Logo */}
      <Image
        src="/logo-performance-horizontal-azul.png"
        alt="AFM Performance"
        width={120}
        height={35}
        className="h-8 w-auto opacity-80"
        priority
      />
      
      {/* Spinner animado */}
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-white shadow-xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
      
      {/* Texto */}
      <div className="text-center">
        <p className="text-slate-700 font-semibold animate-pulse">Carregando...</p>
        <p className="text-sm text-slate-500 mt-1">Por favor, aguarde</p>
      </div>
    </div>
  )
}