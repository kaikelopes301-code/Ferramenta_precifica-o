"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RefreshCw, Home, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log do erro para serviço de monitoramento (ex: Sentry)
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-red-50/20 px-4">
      <div className="text-center max-w-lg mx-auto">
        {/* Ícone de erro */}
        <div className="relative mb-8 inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center border-2 border-red-200 shadow-xl">
            <AlertTriangle className="h-12 w-12 sm:h-14 sm:w-14 text-red-500" />
          </div>
        </div>
        
        {/* Mensagem */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
          Algo deu errado
        </h1>
        <p className="text-slate-600 text-base sm:text-lg mb-8 leading-relaxed">
          Ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver o problema.
        </p>
        
        {/* Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={reset}
            size="lg"
            className="group gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
            Tentar Novamente
          </Button>
          
          <Link href="/">
            <Button
              variant="outline"
              size="lg"
              className="group gap-2 rounded-full px-6 hover:border-blue-300 hover:text-blue-600 transition-all duration-300"
            >
              <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
        
        {/* Código do erro (opcional, para suporte) */}
        {error.digest && (
          <p className="mt-8 text-xs text-slate-400 font-mono">
            Código do erro: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
