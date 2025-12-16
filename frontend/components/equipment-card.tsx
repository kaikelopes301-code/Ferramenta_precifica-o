"use client"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wrench, DollarSign, Calendar, TrendingUp, CheckCircle2, ShoppingCart, Info, X } from "lucide-react"
import type { Equipment } from "@/types/equipment"
import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { MetricsTooltip } from "@/components/metrics-tooltip"

interface EquipmentCardProps {
  equipment: Equipment
  dense?: boolean
  selected?: boolean
  onToggleSelect?: (equipment: Equipment) => void
  onAdd?: (equipment: Equipment) => void
}

export function EquipmentCard({ equipment, dense, selected = false, onToggleSelect, onAdd }: EquipmentCardProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const rawConfidenceScore = equipment.confianca

  const getConfidenceConfig = (confidence: number | null) => {
    // Backend v4.0+ envia valores entre 0..1 (probabilidade)
    if (!confidence) return {
      color: "text-muted-foreground",
      bg: "bg-muted/10",
      label: "N/A",
      icon: "⚪",
      percent: 0
    }

    const confidencePercent = confidence * 100

    if (confidencePercent >= 80) return {
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      label: "Excelente",
      icon: "🟢",
      percent: confidencePercent
    }
    if (confidencePercent >= 75) return {
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-500/10",
      label: "Muito Boa",
      icon: "🟢",
      percent: confidencePercent
    }
    if (confidencePercent >= 50) return {
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-500/10",
      label: "Boa",
      icon: "🟡",
      percent: confidencePercent
    }
    return {
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10",
      label: "Ruim",
      icon: "🟠",
      percent: confidencePercent
    }
  }

  const getMaintenanceConfig = (maintenance: number | null) => {
    if (maintenance === null || maintenance === undefined) return {
      bg: "bg-muted/20 text-muted-foreground border-muted/30",
      label: "N/A",
      icon: "⚪",
      description: "Informação não disponível"
    }
    if (maintenance === 0) {
      return {
        bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        label: "Nenhuma",
        icon: "✨",
        description: "Sem manutenção"
      }
    }
    if (maintenance <= 20) {
      return {
        bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        label: "Baixa",
        icon: "✅",
        description: "Manutenção mínima"
      }
    }
    if (maintenance <= 50) {
      return {
        bg: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
        label: "Média",
        icon: "⚠️",
        description: "Manutenção moderada"
      }
    }
    return {
      bg: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
      label: "Alta",
      icon: "🔧",
      description: "Manutenção frequente"
    }
  }

  const currencyBRL = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined || isNaN(Number(price))) return "Não informado"
    return currencyBRL.format(Number(price))
  }

  // Helper para extrair valores display (v4.0 com fallback para v3.0)
  const getDisplayPrice = () => {
    if (equipment.metrics?.valorUnitario) {
      return equipment.metrics.valorUnitario.display
    }
    return equipment.valor_unitario
  }

  const getDisplayLifespan = () => {
    if (equipment.metrics?.vidaUtilMeses) {
      return equipment.metrics.vidaUtilMeses.display
    }
    return equipment.vida_util_meses
  }

  const getDisplayMaintenance = () => {
    if (equipment.metrics?.manutencao) {
      // Backend envia como fração (0..1), converter para %
      return equipment.metrics.manutencao.display * 100
    }
    return equipment.manutencao_percent
  }

  const confidenceConfig = getConfidenceConfig(equipment.confianca)
  const maintenanceConfig = getMaintenanceConfig(getDisplayMaintenance())

  const title = equipment.sugeridos

  const handleAdd = async () => {
    setIsAdding(true)
    onAdd?.(equipment)
    // Animação visual de feedback
    setTimeout(() => setIsAdding(false), 600)
  }

  return (
    <Card
      className={`group relative overflow-hidden card-premium ${selected ? 'ring-2 ring-blue-500 border-blue-500 shadow-xl shadow-blue-500/20' : ''
        } ${dense ? 'w-[260px] sm:w-[280px] md:min-w-[300px]' : 'w-[280px] sm:w-[300px] md:min-w-[320px] lg:min-w-[340px]'} flex-shrink-0`}
    >
      {/* Brilho gradiente animado no topo */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Efeito de brilho hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Badge de seleção animado */}
      {selected && (
        <div className="absolute top-3 left-3 z-10 animate-pop-in">
          <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-lg shadow-blue-500/50 backdrop-blur-sm font-bold">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Selecionado
          </Badge>
        </div>
      )}

      <CardHeader className={`${dense ? 'space-y-2 pb-3 pt-4' : 'space-y-3 pb-4 pt-5'} relative`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            {/* Ranking badge */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/15 border border-primary/40 shadow-medium">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-black text-primary">#{equipment.ranking}</span>
              </div>
              {equipment.confianca && equipment.confianca >= 0.90 && (
                <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold">
                  Top
                </Badge>
              )}
            </div>

            {/* Nome do equipamento */}
            <h3 className={`${dense ? 'text-sm sm:text-base' : 'text-base sm:text-lg md:text-xl'} font-black leading-tight break-words text-foreground group-hover:text-primary transition-colors`}>
              {title}
            </h3>

            {/* Marca */}
            {equipment.marca && (
              <Badge variant="outline" className="rounded-full text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-0.5 sm:py-1 bg-secondary/60 border-border/60 font-semibold">
                {equipment.marca}
              </Badge>
            )}
          </div>

          {/* Checkbox estilizado */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <label className="relative inline-flex items-center cursor-pointer group/checkbox p-2 -m-2">
              <input
                type="checkbox"
                aria-label="Selecionar sugestão"
                className="sr-only peer"
                checked={selected}
                onChange={() => onToggleSelect?.(equipment)}
              />
              <div className="w-6 h-6 rounded-md border-2 border-border peer-checked:border-primary peer-checked:bg-primary transition-all duration-200 flex items-center justify-center group-hover/checkbox:border-primary/60 group-hover/checkbox:scale-110">
                {selected && (
                  <CheckCircle2 className="h-4 w-4 text-primary-foreground animate-pop-in" />
                )}
              </div>
            </label>
          </div>
        </div>
      </CardHeader>

      <CardContent className={`${dense ? 'space-y-3 pb-3' : 'space-y-4 pb-4'}`}>
        {/* Preço destacado com gradiente - ainda mais premium */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/15 to-primary/8 ${dense ? 'p-4' : 'p-5'} border-2 border-primary/30 shadow-medium hover:shadow-large transition-all duration-300 group/price`}>
          <div className="flex items-center gap-4">
            <div className={`flex ${dense ? 'h-12 w-12' : 'h-16 w-16'} items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/95 to-primary/85 shadow-large group-hover/price:shadow-xl transition-all duration-300 group-hover/price:scale-110`}>
              <DollarSign className={`${dense ? 'h-6 w-6' : 'h-8 w-8'} text-primary-foreground`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Valor Unitário</p>
                {equipment.metrics?.valorUnitario && (
                  <span title="Hover para ver estatísticas">
                    <Info className="h-3 w-3 text-primary/60 cursor-help" />
                  </span>
                )}
              </div>
              <p className={`${dense ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl lg:text-3xl'} font-black text-primary leading-none`}>
                {formatPrice(getDisplayPrice())}
              </p>
              {(() => {
                const p = getDisplayPrice()
                const l = getDisplayLifespan()
                const monthly = (p && l && l > 0) ? p / l : null
                if (!monthly) return null
                return (
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5 ml-0.5">
                    {currencyBRL.format(monthly)}/mês
                  </p>
                )
              })()}
              {equipment.metrics?.valorUnitario && equipment.metrics.valorUnitario.n > 1 && (
                <p className="text-[9px] text-muted-foreground mt-1">
                  baseado em {equipment.metrics.valorUnitario.n} {equipment.metrics.valorUnitario.n === 1 ? 'cotação' : 'cotações'}
                </p>
              )}
            </div>
          </div>
          {/* Brilho decorativo */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-foreground/15 to-transparent rounded-full blur-2xl -translate-y-12 translate-x-12 group-hover/price:scale-150 transition-transform duration-500"></div>
        </div>

        {/* Grid de estatísticas melhorado */}
        <div className={`grid grid-cols-2 ${dense ? 'gap-3' : 'gap-4'}`}>
          {/* Vida útil */}
          <div className={`group/stat rounded-xl border border-border/60 bg-gradient-to-br from-blue-500/5 to-blue-500/10 ${dense ? 'p-3' : 'p-4'} hover:shadow-soft hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-0.5`}>
            <div className="mb-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/15 group-hover/stat:bg-blue-500/25 transition-colors">
                <Calendar className={`${dense ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-blue-600 dark:text-blue-400`} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vida útil</span>
              {equipment.metrics?.vidaUtilMeses && (
                <span title="Hover para ver estatísticas" className="ml-auto">
                  <Info className="h-2.5 w-2.5 text-blue-500/60 cursor-help" />
                </span>
              )}
            </div>
            <p className={`${dense ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-bold text-foreground leading-tight`}>
              {getDisplayLifespan() ? `${getDisplayLifespan()}m` : "N/A"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
              {getDisplayLifespan() ? (equipment.metrics?.vidaUtilMeses ? `${equipment.metrics.vidaUtilMeses.n} amostras` : 'Durabilidade estimada') : 'Não informado'}
            </p>
            {equipment.metrics?.vidaUtilMeses && equipment.metrics.vidaUtilMeses.n < 3 && (
              <Badge variant="outline" className="mt-2 text-[9px] px-2 py-0.5 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                ⚠️ Poucas amostras
              </Badge>
            )}
          </div>

          {/* Confiança */}
          <div
            className={`group/stat rounded-xl border border-border/60 ${confidenceConfig.bg} ${dense ? 'p-3' : 'p-4'} hover:shadow-soft transition-all duration-300 hover:-translate-y-0.5 cursor-help`}
            title="A confiança é calculada a partir do score relativo do grupo mais similar conforme o modelo TF-IDF híbrido."
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${confidenceConfig.bg} group-hover/stat:scale-110 transition-transform`}>
                <TrendingUp className={`${dense ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${confidenceConfig.color}`} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Confiança</span>
              <Info className="h-3 w-3 text-muted-foreground/50 ml-auto" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className={`${dense ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-bold ${confidenceConfig.color} leading-tight`}>
                {equipment.confianca ? `${Math.round(confidenceConfig.percent)}%` : "N/A"}
              </p>
              <span className="text-xs sm:text-sm">{confidenceConfig.icon}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
              {confidenceConfig.label}
            </p>
          </div>
        </div>

        {/* Manutenção com ícone e melhor visual */}
        <div className={`relative overflow-hidden flex items-center justify-between ${dense ? 'p-3' : 'p-4'} rounded-xl border ${maintenanceConfig.bg} hover:shadow-soft transition-all duration-300 group/maintenance`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${maintenanceConfig.bg} group-hover/maintenance:scale-110 transition-transform`}>
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold block leading-none mb-1">Manutenção</span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground">{maintenanceConfig.description}</span>
            </div>
          </div>
          <Badge variant="outline" className={`${maintenanceConfig.bg} font-bold ${dense ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} shadow-soft`}>
            {maintenanceConfig.icon} {maintenanceConfig.label}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className={`${dense ? 'pt-0 pb-3 sm:pb-4 px-3 sm:px-4' : 'pt-0 pb-4 sm:pb-5 px-4 sm:px-5'} flex gap-2 sm:gap-2.5`}>
        {/* Botão de adicionar melhorado */}
        <Button
          type="button"
          onClick={handleAdd}
          disabled={isAdding}
          size="sm"
          className={`flex-1 btn-interactive shadow-medium hover:shadow-xl bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary/95 hover:to-primary text-primary-foreground font-bold transition-all duration-300 text-xs sm:text-sm ${isAdding ? 'scale-95 opacity-80' : ''
            }`}
        >
          {isAdding ? (
            <>
              <CheckCircle2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-pulse-glow" />
              <span className="hidden xs:inline">Adicionado!</span>
              <span className="xs:hidden">✓</span>
            </>
          ) : (
            <>
              <ShoppingCart className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Adicionar</span>
              <span className="xs:hidden">+</span>
            </>
          )}
        </Button>

        {/* Botão de detalhes sem redirecionar */}
        {equipment.link_detalhes && equipment.link_detalhes !== '#' && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsDetailsOpen(true)}
              className="hover:bg-primary/15 hover:border-primary/50 hover:text-primary transition-all duration-300 shadow-medium hover:shadow-xl hover:scale-105"
              aria-label="Ver detalhes"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Dialog.Root open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50  bg-black/40 backdrop-blur-sm" />
                <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl focus:outline-none">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <Dialog.Title className="text-lg font-semibold leading-tight">{equipment.sugeridos}</Dialog.Title>
                    <button
                      onClick={() => setIsDetailsOpen(false)}
                      className="h-8 w-8 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors"
                      aria-label="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/20">
                      <MetricsTooltip
                        label="Valor Unitário"
                        displayValue={formatPrice(getDisplayPrice())}
                        metrics={equipment.metrics?.valorUnitario}
                        unit="BRL"
                        icon={<DollarSign className="h-4 w-4 text-primary" />}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/5 to-transparent border border-blue-500/20">
                      <MetricsTooltip
                        label="Vida Útil"
                        displayValue={getDisplayLifespan() ? `${getDisplayLifespan()} meses` : 'N/A'}
                        metrics={equipment.metrics?.vidaUtilMeses}
                        unit=" meses"
                        icon={<Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20">
                      <MetricsTooltip
                        label="Manutenção"
                        displayValue={getDisplayMaintenance() != null ? `${Math.round(getDisplayMaintenance()!)}%` : 'N/A'}
                        metrics={equipment.metrics?.manutencao}
                        unit="%"
                        icon={<Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                      />
                    </div>

                    {equipment.sources && equipment.sources.nLinhas > 0 && (
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <Info className="h-3.5 w-3.5" />
                            <span>Rastreabilidade</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted-foreground">Amostras:</span>
                              <span className="ml-1 font-bold text-foreground">{equipment.sources.nLinhas}</span>
                            </div>
                            {equipment.sources.fornecedores && equipment.sources.fornecedores.length > 0 && (
                              <div>
                                <span className="text-muted-foreground">Fornecedores:</span>
                                <span className="ml-1 font-bold text-foreground">{equipment.sources.fornecedores.length}</span>
                              </div>
                            )}
                          </div>
                          {equipment.sources.fornecedores && equipment.sources.fornecedores.length > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {equipment.sources.fornecedores.slice(0, 3).join(', ')}
                              {equipment.sources.fornecedores.length > 3 && ` +${equipment.sources.fornecedores.length - 3} outros`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Removido link externo: manter experiência 100% na mesma página */}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        )}
      </CardFooter>

      {/* Efeito de brilho no hover - mais intenso */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/8 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </Card>
  )
}
