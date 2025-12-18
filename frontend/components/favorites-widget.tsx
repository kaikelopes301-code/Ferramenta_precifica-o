"use client"

import { useState } from "react"
import { Heart, X, Download, Trash2, Check, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Equipment } from "@/types/equipment"

export interface FavoriteItem {
  id: string
  equipment: Equipment
  addedAt: Date
}

interface FavoritesWidgetProps {
  items: FavoriteItem[]
  isOpen: boolean
  onClose: () => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function FavoritesWidget({
  items,
  isOpen,
  onClose,
  onRemove,
  onClear,
}: FavoritesWidgetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState("")

  const filteredItems = items.filter(item => 
    item.equipment.sugeridos.toLowerCase().includes(filter.toLowerCase()) ||
    (item.equipment.origemDescricao?.toLowerCase().includes(filter.toLowerCase()))
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filteredItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredItems.map(item => item.id)))
    }
  }

  const downloadCSV = () => {
    const itemsToExport = selected.size > 0 
      ? items.filter(item => selected.has(item.id))
      : items

    if (itemsToExport.length === 0) return

    const headers = [
      'Equipamento',
      'Descrição Original',
      'Valor Unitário (R$)',
      'Vida Útil (meses)',
      'Manutenção (%)',
      'Confiança (%)',
      'Marca'
    ]

    const rows = itemsToExport.map(item => {
      const e = item.equipment
      return [
        `"${e.sugeridos || ''}"`,
        `"${e.origemDescricao || ''}"`,
        e.valor_unitario ?? 'N/A',
        e.vida_util_meses ?? 'N/A',
        e.manutencao_percent ?? 'N/A',
        typeof e.confianca === 'number' ? Math.round(e.confianca * 100) : 'N/A',
        `"${e.marca || 'N/A'}"`
      ].join(',')
    })

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n') // BOM para Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `favoritos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const removeSelected = () => {
    selected.forEach(id => onRemove(id))
    setSelected(new Set())
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-pink-50 to-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl shadow-lg">
              <Heart className="h-5 w-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Favoritos</h2>
              <p className="text-xs sm:text-sm text-slate-500">{items.length} {items.length === 1 ? 'item salvo' : 'itens salvos'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search & Actions Bar */}
        {items.length > 0 && (
          <div className="p-3 sm:p-4 border-b border-slate-100 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar nos favoritos..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selected.size === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={selectAll}
                  className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                />
                <span className="text-xs text-slate-500">
                  {selected.size > 0 ? `${selected.size} selecionado${selected.size > 1 ? 's' : ''}` : 'Selecionar todos'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={removeSelected}
                    className="text-xs h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remover
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCSV}
                  className="text-xs h-8 px-3 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {selected.size > 0 ? 'Baixar Selecionados' : 'Baixar Todos'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="p-4 bg-pink-50 rounded-full mb-4">
                <Heart className="h-10 w-10 text-pink-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum favorito ainda</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Selecione equipamentos nos resultados da busca e clique no coração para salvá-los aqui.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Nenhum item encontrado para "{filter}"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const e = item.equipment
                const isSelected = selected.has(item.id)
                
                return (
                  <div
                    key={item.id}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected 
                        ? 'border-pink-400 bg-pink-50/50 shadow-md' 
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="mt-1 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                      />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                              {e.sugeridos}
                            </h4>
                            {e.origemDescricao && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                Busca: {e.origemDescricao}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemove(item.id)}
                            className="h-7 w-7 rounded-full hover:bg-red-50 hover:text-red-500 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Metrics */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {e.valor_unitario != null && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              R$ {e.valor_unitario.toFixed(2)}
                            </span>
                          )}
                          {e.vida_util_meses != null && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {e.vida_util_meses}m vida útil
                            </span>
                          )}
                          {typeof e.confianca === 'number' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {Math.round(e.confianca * 100)}% conf.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Limpar todos
              </Button>
              <span className="text-xs text-slate-400">
                {items.length} favorito{items.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
