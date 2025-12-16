"use client"

import { Sparkles, Search, FileX, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  type: 'no-search' | 'no-results' | 'error' | 'no-data'
  title?: string
  description?: string
  lastQuery?: string
  onAction?: () => void
  actionLabel?: string
}

export function EmptyState({ 
  type, 
  title, 
  description, 
  lastQuery,
  onAction,
  actionLabel 
}: EmptyStateProps) {
  const configs = {
    'no-search': {
      icon: Sparkles,
      defaultTitle: 'Comece sua busca',
      defaultDescription: 'Digite a descrição dos equipamentos que você precisa precificar e receba sugestões inteligentes',
      iconColor: 'text-primary',
      bgColor: 'from-primary/25 via-primary/20 to-primary/15',
      borderColor: 'border-primary/30'
    },
    'no-results': {
      icon: Search,
      defaultTitle: 'Nenhum resultado encontrado',
      defaultDescription: 'Não encontramos equipamentos correspondentes à sua busca. Tente usar palavras diferentes ou seja mais específico.',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'from-yellow-500/25 via-yellow-500/20 to-yellow-500/15',
      borderColor: 'border-yellow-500/30'
    },
    'error': {
      icon: AlertCircle,
      defaultTitle: 'Algo deu errado',
      defaultDescription: 'Não foi possível completar sua solicitação. Por favor, tente novamente.',
      iconColor: 'text-destructive',
      bgColor: 'from-destructive/25 via-destructive/20 to-destructive/15',
      borderColor: 'border-destructive/30'
    },
    'no-data': {
      icon: FileX,
      defaultTitle: 'Nenhum dado disponível',
      defaultDescription: 'Faça upload de uma planilha para começar a usar a ferramenta de precificação.',
      iconColor: 'text-muted-foreground',
      bgColor: 'from-muted/25 via-muted/20 to-muted/15',
      borderColor: 'border-muted/30'
    }
  }

  const config = configs[type]
  const Icon = config.icon

  const searchTips = lastQuery ? [
    !/(110|127|220|12v|24v|bivolt|\bv\b)/.test(lastQuery.toLowerCase()) && 'Inclua voltagem ou tensão (ex.: 220V, 127V, bivolt)',
    !/(nylon|aço|inox|piaçava|algodão|microfibra|plástico|borracha)/.test(lastQuery.toLowerCase()) && 'Informe material (ex.: nylon, inox, microfibra, piaçava)',
    !/(tamanho|\b\d+\s?cm\b|\b\d+\s?mm\b|\b\d+\s?l\b)/.test(lastQuery.toLowerCase()) && 'Adicione tamanho/capacidade (ex.: 60 cm, 10 mm, 20 L)',
    !/(bosch|makita|karcher|wap|3m|tramontina|voith|flash\s?limp|kärcher)/.test(lastQuery.toLowerCase()) && !/marca|modelo/.test(lastQuery.toLowerCase()) && 'Se souber, inclua marca/modelo para maior precisão'
  ].filter(Boolean) : []

  return (
    <div className="mt-20 sm:mt-24 md:mt-32 text-center animate-fade-slide-up px-4">
      {/* Ícone animado */}
      <div className={`mx-auto mb-8 sm:mb-10 flex h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 items-center justify-center rounded-full bg-gradient-to-br ${config.bgColor} border-2 ${config.borderColor} shadow-xl relative`}>
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75"></div>
        <Icon className={`h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 ${config.iconColor} animate-pulse-glow relative z-10`} />
      </div>

      {/* Título */}
      <h3 className="mb-4 sm:mb-5 text-2xl sm:text-3xl font-black bg-gradient-to-r from-foreground to-foreground/85 bg-clip-text text-transparent">
        {title || config.defaultTitle}
      </h3>

      {/* Descrição */}
      <p className="text-muted-foreground text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
        {description || config.defaultDescription}
      </p>

      {/* Dicas de busca (apenas para no-results) */}
      {type === 'no-results' && searchTips.length > 0 && (
        <div className="mb-10 sm:mb-12 max-w-2xl mx-auto text-left card-glass rounded-2xl p-6 sm:p-7 shadow-xl border-2 border-border/70">
          <p className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Sugestões para melhorar sua busca:
          </p>
          <ul className="list-disc pl-6 space-y-2.5 text-sm text-muted-foreground font-medium">
            {searchTips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Botão de ação */}
      {onAction && actionLabel && (
        <Button
          onClick={onAction}
          size="lg"
          className="btn-interactive shadow-large hover:shadow-xl px-8 sm:px-10 py-5 sm:py-6 text-base font-bold tracking-wide"
        >
          {actionLabel}
        </Button>
      )}

      {/* Tags de exemplo (apenas para no-search) */}
      {type === 'no-search' && (
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm mt-8">
          {['vassouras', 'mops', 'aspiradores', 'panos', 'baldes'].map((tag) => (
            <span 
              key={tag}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-muted/60 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-all duration-300 cursor-pointer hover:scale-105 shadow-medium hover:shadow-large font-semibold"
              role="button"
              tabIndex={0}
              aria-label={`Buscar ${tag}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
