"use client"

import { Loader2, Sparkles, Search } from "lucide-react"

interface LoadingStateProps {
  type?: 'search' | 'upload' | 'general'
  message?: string
}

export function LoadingState({ type = 'general', message }: LoadingStateProps) {
  const configs = {
    search: {
      icon: Search,
      defaultMessage: 'Analisando equipamentos...',
      iconColor: 'text-primary'
    },
    upload: {
      icon: Sparkles,
      defaultMessage: 'Processando arquivo...',
      iconColor: 'text-primary'
    },
    general: {
      icon: Loader2,
      defaultMessage: 'Carregando...',
      iconColor: 'text-primary'
    }
  }

  const config = configs[type]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 md:py-24 animate-fade-slide-up">
      {/* Ícone animado */}
      <div className="relative mb-6 sm:mb-8">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
        <div className="relative inline-flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-primary/20 via-primary/30 to-primary/20 border-2 border-primary/40 shadow-xl">
          <Icon className={`h-8 w-8 sm:h-10 sm:w-10 ${config.iconColor} ${type === 'general' ? 'animate-spin' : 'animate-pulse'}`} />
        </div>
      </div>

      {/* Mensagem */}
      <p className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-2 tracking-wide">
        {message || config.defaultMessage}
      </p>

      {/* Barra de progresso indeterminada */}
      <div className="w-48 sm:w-64 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full animate-progress-indeterminate"></div>
      </div>

      {/* Texto auxiliar */}
      <p className="text-xs sm:text-sm text-muted-foreground mt-4 font-medium">
        Por favor, aguarde...
      </p>
    </div>
  )
}
