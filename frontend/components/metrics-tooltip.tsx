"use client"

import { Info } from "lucide-react"
import * as Tooltip from "@radix-ui/react-tooltip"
import type { NumericMetrics } from "@/app/page"

interface MetricsTooltipProps {
  label: string
  displayValue: string
  metrics?: NumericMetrics
  unit?: string
  icon?: React.ReactNode
}

export function MetricsTooltip({ label, displayValue, metrics, unit = "", icon }: MetricsTooltipProps) {
  // Se não tem métricas agregadas, exibir apenas o valor
  if (!metrics) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-semibold">{displayValue}</span>
      </div>
    )
  }

  const { n, min, max, mean, median } = metrics
  const hasLowSampleSize = n < 3
  const range = max - min
  const hasHighVariation = range / mean > 0.5 // Variação > 50% da média
  
  const currencyBRL = new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })

  const formatValue = (value: number) => {
    if (unit === 'BRL') {
      return currencyBRL.format(value)
    }
    if (unit === '%') {
      return `${Math.round(value * 100)}%`
    }
    return `${value}${unit}`
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="flex items-center justify-between group cursor-help">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium">{label}</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{displayValue}</span>
              {hasLowSampleSize && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30">
                  {n} amostras
                </span>
              )}
              {hasHighVariation && !hasLowSampleSize && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30">
                  Alta variação
                </span>
              )}
            </div>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={8}
            className="z-50 overflow-hidden rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md px-4 py-3 text-sm shadow-xl animate-in fade-in-0 zoom-in-95 min-w-[280px] max-w-[320px]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="font-bold text-foreground">Estatísticas</span>
                <span className="text-xs text-muted-foreground">
                  Baseado em <span className="font-bold text-primary">{n}</span> {n === 1 ? 'cotação' : 'cotações'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mediana</div>
                  <div className="text-sm font-bold text-foreground">{formatValue(median)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Média</div>
                  <div className="text-sm font-bold text-foreground">{formatValue(mean)}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Faixa de Valores</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-muted-foreground">Mínimo</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatValue(min)}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-gradient-to-r from-emerald-500 via-yellow-500 to-orange-500 rounded-full"></div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-muted-foreground">Máximo</span>
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{formatValue(max)}</span>
                  </div>
                </div>
              </div>

              {hasLowSampleSize && (
                <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-2">
                    <span className="text-xs">⚠️</span>
                    <p className="text-[11px] text-yellow-700 dark:text-yellow-400 leading-snug">
                      <span className="font-bold">Poucas amostras:</span> Valores podem não ser representativos. Recomendamos cautela.
                    </p>
                  </div>
                </div>
              )}

              {hasHighVariation && !hasLowSampleSize && (
                <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-start gap-2">
                    <span className="text-xs">📊</span>
                    <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-snug">
                      <span className="font-bold">Alta variação:</span> Diferença significativa entre fornecedores. O valor exibido é a mediana.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <Tooltip.Arrow className="fill-popover/95" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
