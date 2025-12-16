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
        ; (['A5', 'A6', 'A7', 'B5', 'B6', 'B7'] as const).forEach((addr) => {
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
        ; (['C5', 'C6', 'C7', 'D5', 'D6', 'D7'] as const).forEach((addr) => {
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
        ; (['E5', 'E6', 'E7', 'F5', 'F6', 'F7'] as const).forEach((addr) => {
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
        const headers = ['Descrição (Usuário)', 'Sugestão', 'Quantidade', 'Vida Útil (meses)', 'Preço Unitário', 'Manutenção (%)', 'Subtotal']
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
      {/* Overlay Backdrop - Smooth Fade */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[90] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel do Carrinho - Premium Slide-over */}
      <div
        className={`fixed top-2 bottom-2 right-2 w-[95%] sm:w-[480px] bg-white/90 backdrop-blur-2xl shadow-2xl z-[100] transform transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) flex flex-col rounded-[2rem] border border-white/20 focus:outline-none ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[110%] opacity-0'
          }`}
      >
        {/* Header com Design Limpo */}
        <div className="px-6 py-6 border-b border-slate-100/50 bg-white/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Seu Carrinho</h2>
                <div className="text-sm font-medium text-slate-400">{items.length} {items.length === 1 ? 'item' : 'itens'} adicionados</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all duration-300 hover:rotate-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
            <span className="text-sm font-semibold text-blue-700/80 uppercase tracking-wide px-2">Total Estimado</span>
            <span className="text-2xl font-black text-slate-900 bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent px-2">
              {currencyBRL.format(totals.totalPrice)}
            </span>
          </div>
        </div>

        {/* Lista Scrollável */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
              <div className="w-24 h-24 rounded-full bg-slate-50 mb-6 flex items-center justify-center shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/50" />
                <ShoppingCart className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Seu carrinho está vazio</h3>
              <p className="text-slate-500 max-w-[200px] leading-relaxed">
                Explore nosso catálogo e adicione equipamentos para começar seu orçamento.
              </p>
            </div>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="group relative bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-[1.5rem] p-4 overflow-hidden"
              >
                {/* Efeito hover lateral */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Título Editável */}
                    <div className="mb-2">
                      {editingId === it.id ? (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = editingValue.trim()
                                if (val) onChangeName(it.id, val)
                                setEditingId(null)
                              }
                            }}
                            autoFocus
                            className="w-full text-base font-semibold px-2 py-1 rounded-lg border-2 border-blue-100 bg-blue-50 text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                          />
                          <button onClick={() => { if (editingValue.trim()) onChangeName(it.id, editingValue.trim()); setEditingId(null) }} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-slate-800 text-base leading-snug cursor-text hover:text-blue-700 transition-colors" onClick={() => { setEditingId(it.id); setEditingValue(it.name) }} title="Clique para editar">
                            {it.name}
                          </h3>
                        </div>
                      )}
                      <div className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-1">
                        {it.marca && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{it.marca}</span>}
                        <span>{it.price != null ? currencyBRL.format(it.price) : 'Consulte'} unit.</span>
                      </div>
                    </div>

                    {/* Controles Inferiores */}
                    <div className="flex items-center justify-between mt-4 bg-slate-50/80 rounded-xl p-1.5 border border-slate-100">
                      <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm border border-slate-100 p-0.5">
                        <button
                          onClick={() => onChangeQty(it.id, Math.max(1, it.qty - 1))}
                          disabled={it.qty <= 1}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-800">{it.qty}</span>
                        <button
                          onClick={() => onChangeQty(it.id, it.qty + 1)}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>

                      <div className="px-3 font-bold text-slate-900 text-sm">
                        {it.price != null ? currencyBRL.format(it.price * it.qty) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Botão Remover Lateral */}
                  <div className="flex flex-col items-center gap-2 border-l border-slate-100 pl-3 ml-1">
                    <button
                      onClick={() => onRemove(it.id)}
                      className="h-8 w-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {editingId !== it.id && (
                      <button
                        onClick={() => { setEditingId(it.id); setEditingValue(it.name) }}
                        className="h-8 w-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all duration-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Área de Obs */}
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <textarea
                    placeholder="Adicionar observação..."
                    value={it.notes || ''}
                    onChange={(e) => onChangeNotes(it.id, e.target.value)}
                    rows={1}
                    className="w-full text-xs font-medium px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white rounded-xl border border-transparent hover:border-slate-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none placeholder:text-slate-400"
                    onInput={(e) => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      el.style.height = el.scrollHeight + 'px'
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="p-6 bg-white border-t border-slate-100 shrink-0">
            <Button
              onClick={exportExcel}
              className="group w-full h-14 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/10 hover:shadow-blue-600/20 transition-all duration-300 mb-3 flex items-center justify-center gap-3"
            >
              <span className="bg-white/20 p-1.5 rounded-lg group-hover:bg-white/30 transition-colors">
                <Download className="h-5 w-5" strokeWidth={2.5} />
              </span>
              Gerar Orçamento
            </Button>

            <button
              onClick={onClear}
              className="w-full py-3 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2 hover:bg-red-50 rounded-xl"
            >
              <Trash2 className="h-4 w-4" />
              Esvaziar carrinho
            </button>
          </div>
        )}
      </div>
    </>
  )
}
