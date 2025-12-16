"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, ShoppingCart, Trash2, X, Plus, Minus, Pencil, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export type CartItem = {
  id: string
  name: string
  price: number | null
  qty: number
  notes?: string
  vidaUtilMeses?: number | null
  manutencaoPercent?: number | null
  fornecedor?: string | null
  marca?: string | null
  descricao?: string | null
}

const currencyBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface CartWidgetProps {
  items: CartItem[]
  isOpen: boolean
  onClose: () => void
  onClear: () => void
  onRemove: (id: string) => void
  onChangeQty: (id: string, qty: number) => void
  onChangeNotes: (id: string, notes: string) => void
  onChangeName: (id: string, name: string) => void
}

export function CartWidget({ items, isOpen, onClose, onClear, onRemove, onChangeQty, onChangeNotes, onChangeName }: CartWidgetProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>("")
  const { toast } = useToast()
  const totals = useMemo(() => {
    const totalQty = items.reduce((acc, it) => acc + (it.qty || 0), 0)
    const totalPrice = items.reduce((acc, it) => acc + ((it.price || 0) * (it.qty || 0)), 0)
    return { totalQty, totalPrice }
  }, [items])

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const exportExcel = async () => {
    // [Mantém toda a lógica de exportação existente]
    try {
      toast({ title: '⏳ Gerando arquivo', description: 'Preparando planilhas…' })
      const mod = await import('exceljs')
      const ExcelJS: any = (mod as any)?.default ?? mod
      const wb = new ExcelJS.Workbook()

      const currencyFmt = 'R$ #,##0.00'
      // Paleta de cores e estilos
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2747' } }
      const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true }
      const headerAlign = { vertical: 'middle', horizontal: 'center' } as const
      const borderThin = {
        top: { style: 'thin', color: { argb: 'FF26435F' } },
        left: { style: 'thin', color: { argb: 'FF26435F' } },
        bottom: { style: 'thin', color: { argb: 'FF26435F' } },
        right: { style: 'thin', color: { argb: 'FF26435F' } },
      } as const
      const kpiBoxFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F7F9' } }
      const kpiTitleFont = { color: { argb: 'FF4B5563' }, bold: true } // cinza 600
      const kpiValueFont = { color: { argb: 'FF0F172A' }, bold: true, size: 16 }

      // Cálculos básicos: agregamos por (descricao + id) para manter clareza na origem
      const resumoMap = new Map<string, { desc: string | null; name: string; price: number | null; qty: number; vida: number | null; manperc: number | null }>()
      for (const it of items) {
        const key = `${it.descricao || ''}__${it.id}`
        const ex = resumoMap.get(key)
        if (ex) resumoMap.set(key, { ...ex, qty: ex.qty + (it.qty || 0) })
        else resumoMap.set(key, { desc: it.descricao || '', name: it.name, price: it.price ?? null, qty: it.qty || 0, vida: it.vidaUtilMeses ?? null, manperc: it.manutencaoPercent ?? null })
      }
  const totalItensUnicos = resumoMap.size
      const quantidadeTotal = items.reduce((acc, it) => acc + (it.qty || 0), 0)
      let valorTotal = 0
      resumoMap.forEach((v) => {
        const sub = v.price != null ? v.price * v.qty : null
        if (sub != null) valorTotal += sub
      })

      // 1) Visão Geral (capa) — amigável para gestores
      const wsOverview = wb.addWorksheet('Visão Geral')
      // Definir largura padrão das colunas A..F
      wsOverview.columns = [
        { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
      ]
      // Título (A1:F2)
      wsOverview.mergeCells('A1:F2')
      const titleCell = wsOverview.getCell('A1')
      titleCell.value = 'Relatório de Precificação — Carrinho'
      titleCell.fill = headerFill
      titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 18 }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      // Data/Hora (A3:F3)
      wsOverview.mergeCells('A3:F3')
      const whenCell = wsOverview.getCell('A3')
      whenCell.value = `Gerado em ${new Date().toLocaleString('pt-BR')}`
      whenCell.alignment = { vertical: 'middle', horizontal: 'center' }
      whenCell.font = { color: { argb: 'FF6B7280' } }

      // KPIs em 3 cartões: Itens únicos, Quantidade total, Valor total
      // Cartão 1: A5:B7
      wsOverview.mergeCells('A5:B7')
      const kpi1 = wsOverview.getCell('A5')
      kpi1.value = {
        richText: [
          { text: 'Itens únicos\n', font: kpiTitleFont },
          { text: String(totalItensUnicos), font: kpiValueFont },
        ],
      } as any
      kpi1.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      kpi1.fill = kpiBoxFill
      ;(['A5','A6','A7','B5','B6','B7'] as const).forEach((addr) => {
        wsOverview.getCell(addr).border = borderThin
      })

      // Cartão 2: C5:D7
      wsOverview.mergeCells('C5:D7')
      const kpi2 = wsOverview.getCell('C5')
      kpi2.value = {
        richText: [
          { text: 'Quantidade total\n', font: kpiTitleFont },
          { text: String(quantidadeTotal), font: kpiValueFont },
        ],
      } as any
      kpi2.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      kpi2.fill = kpiBoxFill
      ;(['C5','C6','C7','D5','D6','D7'] as const).forEach((addr) => {
        wsOverview.getCell(addr).border = borderThin
      })

      // Cartão 3: E5:F7
      wsOverview.mergeCells('E5:F7')
      const kpi3 = wsOverview.getCell('E5')
      kpi3.value = {
        richText: [
          { text: 'Valor total\n', font: kpiTitleFont },
          { text: currencyBRL.format(valorTotal), font: kpiValueFont },
        ],
      } as any
      kpi3.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      kpi3.fill = kpiBoxFill
      ;(['E5','E6','E7','F5','F6','F7'] as const).forEach((addr) => {
        wsOverview.getCell(addr).border = borderThin
      })

      // 2) Itens detalhados (uma linha por unidade)
      const wsItens = wb.addWorksheet('Itens', { views: [{ state: 'frozen', ySplit: 1 }] })
      wsItens.columns = [
        { header: 'Descrição (Usuário)', key: 'desc', width: 40 },
        { header: 'Sugestão', key: 'item', width: 50 },
        { header: 'Observações', key: 'obs', width: 40 },
        { header: 'Vida Útil (meses)', key: 'vida', width: 18 },
        { header: 'Quantidade', key: 'qty', width: 14 },
        { header: 'Preço Unitário', key: 'pu', width: 18, style: { numFmt: currencyFmt } },
        { header: 'Manutenção (%)', key: 'manperc', width: 16, style: { numFmt: '0.00%' } },
        { header: 'Subtotal', key: 'sub', width: 18, style: { numFmt: currencyFmt } },
      ]
      items.forEach((it) => {
        const q = Math.max(1, it.qty || 1)
        for (let i = 0; i < q; i++) {
          wsItens.addRow({ desc: it.descricao || '', item: it.name, obs: it.notes || '', vida: it.vidaUtilMeses ?? null, qty: 1, pu: it.price ?? null, manperc: it.manutencaoPercent != null ? it.manutencaoPercent / 100 : null, sub: it.price ?? null })
        }
      })
      wsItens.getRow(1).eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = headerAlign
        cell.border = borderThin
      })
      for (let r = 2; r <= wsItens.rowCount; r++) {
        const row = wsItens.getRow(r)
        row.eachCell((cell: any, colNumber: number) => {
          cell.border = borderThin
          if (colNumber >= 4) cell.alignment = { vertical: 'middle', horizontal: 'right' }
          else if (colNumber === 3) cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
          else cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
        })
        if (r % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F7F9' } }
      }
      wsItens.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } }

      // Gerar arquivo Excel
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Resultados.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: '✅ Exportado com sucesso', description: 'Arquivo Resultados.xlsx gerado.' })
      return
      } catch (e) {
      // Fallback para CSV caso o Excel falhe (problemas de bundle do exceljs, etc.)
      try {
        const headers = ['Descrição (Usuário)','Sugestão','Quantidade','Vida Útil (meses)','Preço Unitário','Manutenção (%)','Subtotal']
        const resumoMap = new Map<string, { desc: string | null; name: string; price: number | null; qty: number; vida: number | null; manperc: number | null }>()
        for (const it of items) {
          const key = `${it.descricao || ''}__${it.id}`
          const ex = resumoMap.get(key)
          if (ex) resumoMap.set(key, { ...ex, qty: ex.qty + (it.qty || 0) })
          else resumoMap.set(key, { desc: it.descricao || '', name: it.name, price: it.price ?? null, qty: it.qty || 0, vida: it.vidaUtilMeses ?? null, manperc: it.manutencaoPercent ?? null })
        }
        const rows: string[] = []
        resumoMap.forEach((v) => {
          const sub = v.price != null ? v.price * v.qty : null
          rows.push([
            `"${v.desc || ''}"`,
            `"${v.name}"`,
            String(v.qty),
            v.vida ?? '',
            v.price != null ? v.price.toFixed(2) : '',
            v.manperc != null ? (v.manperc).toFixed(2) : '',
            sub != null ? sub.toFixed(2) : ''
          ].join(','))
        })
        const csv = [headers.join(','), ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'carrinho.csv'
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: '✅ Exportado em CSV', description: 'Não foi possível gerar Excel; usamos CSV como alternativa.' })
        return
      } catch (err) {
        console.error('Export error', err)
        toast({ title: '❌ Falha ao exportar', description: 'Tente novamente ou atualize a página.', variant: 'destructive' })
      }
    }
  }

  return (
    <>
      {/* Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90] transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Painel do Carrinho Slide-over */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl border-l border-slate-100 z-[100] transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header Minimalista */}
        <div className="px-6 py-5 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Seu Carrinho
            </h2>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 hover:text-slate-900"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-500">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {currencyBRL.format(totals.totalPrice)}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">Carrinho vazio</p>
                <p className="text-sm text-slate-500">Adicione equipamentos para começar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((it) => (
                <div 
                  key={it.id}
                  className="group relative"
                >
                  {/* Info do Item */}
                  <div className="flex gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      {editingId === it.id ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newVal = editingValue.trim()
                                if (newVal) onChangeName(it.id, newVal)
                                setEditingId(null)
                              } else if (e.key === 'Escape') {
                                setEditingId(null)
                              }
                            }}
                            onBlur={() => {
                              const newVal = editingValue.trim()
                              if (newVal) onChangeName(it.id, newVal)
                              setEditingId(null)
                            }}
                            autoFocus
                            className="flex-1 min-w-0 text-sm px-2 py-1 rounded-md border border-blue-200 bg-blue-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            onClick={() => {
                              const newVal = editingValue.trim()
                              if (newVal) onChangeName(it.id, newVal)
                              setEditingId(null)
                            }}
                            className="h-7 w-7 rounded-lg hover:bg-blue-100 text-blue-600 flex items-center justify-center"
                            title="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1 group/title">
                          <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate cursor-default" title={it.name}>
                            {it.name}
                          </h3>
                          <button
                            onClick={() => { setEditingId(it.id); setEditingValue(it.name) }}
                            className="opacity-0 group-hover/title:opacity-100 h-6 w-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 flex items-center justify-center flex-shrink-0 transition-all"
                            title="Editar nome"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs font-medium text-slate-500">
                        {it.price != null ? currencyBRL.format(it.price) : 'Preço sob consulta'}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(it.id)}
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all flex-shrink-0"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Controles */}
                  <div className="flex items-center justify-between gap-4 bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                    {/* Quantidade */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onChangeQty(it.id, Math.max(1, it.qty - 1))}
                        className="h-7 w-7 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-slate-400"
                        disabled={it.qty <= 1}
                      >
                        <Minus className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-700">{it.qty}</span>
                      <button
                        onClick={() => onChangeQty(it.id, it.qty + 1)}
                        className="h-7 w-7 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                      >
                        <Plus className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-sm font-bold text-slate-900">
                      {it.price != null ? currencyBRL.format(it.price * it.qty) : '—'}
                    </div>
                  </div>

                  {/* Observações */}
                  <textarea
                    placeholder="Adicionar observações..."
                    value={it.notes || ''}
                    rows={1}
                    onChange={(e) => onChangeNotes(it.id, e.target.value)}
                    onInput={(e) => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      const lineH = parseFloat(getComputedStyle(el).lineHeight || '20') || 20
                      const maxH = lineH * 3
                      const nextH = Math.min(el.scrollHeight, maxH)
                      el.style.height = `${nextH}px`
                      el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
                    }}
                    className="mt-2 w-full text-xs px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 focus:border-blue-300 bg-transparent hover:bg-slate-50 focus:bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        {items.length > 0 && (
          <div className="px-6 py-6 border-t border-slate-100 bg-white space-y-3 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] z-20">
            <Button
              onClick={exportExcel}
              className="w-full h-12 bg-slate-900 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-lg shadow-slate-900/10 hover:shadow-blue-700/20 transition-all duration-300"
            >
              <Download className="mr-2 h-5 w-5" strokeWidth={2} />
              Exportar Orçamento
            </Button>
            
            <button
              onClick={onClear}
              className="w-full text-sm font-medium text-slate-500 hover:text-red-600 py-2 transition-colors"
            >
              Esvaziar carrinho
            </button>
          </div>
        )}
      </div>
    </>
  )
}
