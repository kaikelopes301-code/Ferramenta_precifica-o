"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { Navbar } from "@/components/navbar"
import { CursorFollower } from "@/components/cursor-follower"
import { SearchInput } from "@/components/search-input"
import { EquipmentCard } from "@/components/equipment-card"
import { EquipmentCardSkeleton } from "@/components/equipment-card-skeleton"
import { EmptyState } from "@/components/empty-state"
import { LoadingState } from "@/components/loading-state"
import { SkipLinks } from "@/components/skip-links"
import { Sparkles, Upload, Download, TrendingUp, Zap, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { Equipment, NumericMetrics, EquipmentSources } from "@/types/equipment"
import { InteractiveBackground } from "@/components/interactive-background"
import { InfoModal } from "@/components/info-modal"

// Adia carregamento de componentes não críticos para reduzir JS inicial
const HorizontalScroll = dynamic(() => import("@/components/horizontal-scroll").then(m => m.HorizontalScroll), { ssr: false, loading: () => null })
const CartWidget = dynamic(() => import("@/components/cart-widget").then(m => m.CartWidget), { ssr: false, loading: () => null })
type CartItem = import("@/components/cart-widget").CartItem

export default function Home() {
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [batchGroups, setBatchGroups] = useState<Array<{ descricao: string; itens: Equipment[] }>>([])
  const [lastQuery, setLastQuery] = useState("")
  const [batchSortMap, setBatchSortMap] = useState<Record<string, string>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const { toast } = useToast()
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const USER_ID = 'demo-user'
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [singleFilter, setSingleFilter] = useState("")
  const [singleSort, setSingleSort] = useState<'conf-desc'|'price-asc'|'price-desc'|'life-desc'>('conf-desc')

  const checkDataStatus = async () => {
    try {
      const response = await fetch('/api/data/status')
      const data = await response.json()
      setHasData(data.dataset?.total_products > 0)
    } catch (error) {
      console.error('Erro ao verificar status dos dados:', error)
    }
  }

  useEffect(() => {
    checkDataStatus()
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      // Simulação de upload para permitir visualização da interface
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setHasData(true);
      setUploadingFile(false);
      
      toast({
        title: "✅ Sucesso!",
        description: "Ambiente de busca desbloqueado com sucesso.",
      });
      
      // Limpar input
      event.target.value = '';
      
      /* 
      // TODO: Implementar quando backend TS tiver rota /api/upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        throw new Error('Erro no upload')
      }
      const result = await response.json()
      setHasData(true)
      toast({
        title: "✅ Sucesso!",
        description: `Planilha carregada com ${result.rows} linhas`,
      })
      */
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Falha ao carregar planilha",
        variant: "destructive",
      })
    } finally {
      setUploadingFile(false)
      event.target.value = ''
    }
  }

  useEffect(() => {
    if (!isLoading && (equipments.length > 0 || batchGroups.length > 0)) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [isLoading, equipments.length, batchGroups.length])

  const splitDescriptions = (text: string): string[] => {
    // Divide por: quebras de linha, ponto-e-vírgula, ou vírgula
    // O lookahead (?!\d) evita quebrar números decimais (1,5) e (?!\s*\d) evita quebrar "volume 1, 2 litros"
    const parts = text
      .split(/\r?\n|;\s*|,\s*(?!\d)/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    return parts.length > 0 ? parts : [text.trim()]
  }

  const itemId = (e: Equipment) => `${e.sugeridos}__${e.valor_unitario ?? 'na'}__${e.vida_util_meses ?? 'na'}`

  const addToCart = (e: Equipment) => {
    const baseId = itemId(e)
    const descKey = (e.origemDescricao ?? lastQuery ?? '').trim()
    const cartId = `${baseId}__d:${descKey}`
    setCart(prev => {
      const idx = prev.findIndex(it => it.id === cartId)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }
        return copy
      }
      return [...prev, { id: cartId, name: e.sugeridos, price: e.valor_unitario ?? null, qty: 1, vidaUtilMeses: e.vida_util_meses ?? null, manutencaoPercent: e.manutencao_percent ?? null, fornecedor: null, marca: e.marca ?? null, descricao: e.origemDescricao ?? lastQuery }]
    })
    toast({ 
      title: '🛒 Adicionado ao carrinho', 
      description: e.sugeridos,
      // Removed duration as it is not part of ToastProps
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart:add'))
    }
  }

  const addSelectedToCart = (list: Equipment[]) => {
    if (selected.size === 0) return
    setCart(prev => {
      const next = [...prev]
      for (const e of list) {
        const baseId = itemId(e)
        if (!selected.has(baseId)) continue
        const descKey = (e.origemDescricao ?? lastQuery ?? '').trim()
        const cartId = `${baseId}__d:${descKey}`
        const idx = next.findIndex(it => it.id === cartId)
        if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        else next.push({ id: cartId, name: e.sugeridos, price: e.valor_unitario ?? null, qty: 1, vidaUtilMeses: e.vida_util_meses ?? null, manutencaoPercent: e.manutencao_percent ?? null, fornecedor: null, marca: e.marca ?? null, descricao: e.origemDescricao ?? lastQuery })
      }
      return next
    })
    toast({ title: '✅ Itens adicionados', description: `${selected.size} selecionados` })
    setSelected(new Set())
    setLastSelectedIdx(null)
  }

  const clearCart = () => setCart([])
  const removeFromCart = (id: string) => setCart(prev => prev.filter(it => it.id !== id))
  const changeQty = (id: string, qty: number) => setCart(prev => prev.map(it => it.id === id ? { ...it, qty: Math.max(1, qty) } : it))
  const changeNotes = (id: string, notes: string) => setCart(prev => prev.map(it => it.id === id ? { ...it, notes } : it))
  const changeName = (id: string, name: string) => setCart(prev => prev.map(it => it.id === id ? { ...it, name } : it))

  const handleSearch = async (description: string, options: { topK: number, useTfidf: boolean }) => {
    setLastQuery(description)
    if (!hasData) {
      toast({
        title: "⚠️ Dados necessários",
        description: "Faça upload de uma planilha primeiro",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setEquipments([])
    setBatchResults([])
    setBatchGroups([])

    try {
      const descricoes = splitDescriptions(description)

      if (descricoes.length === 1) {
        // Busca individual (1 descrição apenas)
        const searchResponse = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
          body: JSON.stringify({ query: descricoes[0] || description, top_k: options.topK })
        })
        // Tolera resposta não-OK: tenta extrair JSON e faz fallback gracioso
        const searchData = await searchResponse.json().catch(() => ({ resultados: [] }))
        
        if (!searchResponse.ok) {
          console.warn('Busca inteligente retornou erro', searchData)
          toast({
            title: '⚠️ Aviso',
            description: 'O serviço de busca demorou ou retornou erro. Tentaremos novamente em seguida.',
          })
        }
        // Backend v4.0+ envia confidenceItem como 0..1
        const mapped = (searchData.resultados || []).map((r: any, idx: number) => {
          // Priorizar confidenceItem (v4.0), fallback para score_normalized (v3.0)
          const rawConfidence = r.confidenceItem ?? r.score_normalized ?? r.score ?? null
          const confidence = typeof rawConfidence === 'number' ? rawConfidence : null
          
          // Mapear métricas v4.0 se disponíveis
          const metrics = r.metrics ? {
            valorUnitario: r.metrics.valorUnitario,
            vidaUtilMeses: r.metrics.vidaUtilMeses,
            manutencao: r.metrics.manutencao
          } : undefined
          
          const sources = r.sources ? {
            fornecedores: r.sources.fornecedores,
            bids: r.sources.bids,
            nLinhas: r.sources.nLinhas ?? 0
          } : undefined
          
          return {
            ranking: r.ranking ?? (idx + 1),
            sugeridos: r.sugeridos || r.descricao || r.grupo,
            equipmentId: r.equipmentId,
            title: r.title,
            // Campos legacy (v3.0) - usar como fallback
            valor_unitario: r.valor_unitario ?? metrics?.valorUnitario?.display ?? null,
            vida_util_meses: r.vida_util_meses ?? metrics?.vidaUtilMeses?.display ?? null,
            manutencao_percent: r.manutencao_percent ?? (metrics?.manutencao?.display ? metrics.manutencao.display * 100 : null),
            // Campos v4.0
            metrics,
            sources,
            confianca: confidence,
            link_detalhes: r.link_detalhes || '#',
            marca: r.marca ?? null,
            origemDescricao: descricoes[0] || description
          }
        })
        
        setEquipments(mapped)
      } else {
        // Busca em lote (2+ descrições) - fazer múltiplas chamadas individuais
        const batchPromises = descricoes.map(desc => 
          fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
            body: JSON.stringify({ query: desc, top_k: options.topK }),
          }).then(r => r.json().catch(() => ({ query_original: desc, resultados: [] })))
        );
        const batchData = await Promise.all(batchPromises);
        
        // Verificar se houve erros
        const hasErrors = batchData.some(d => !d.resultados || d.resultados.length === 0);
        if (hasErrors) {
          console.warn('Algumas buscas em lote falharam', batchData)
          toast({
            title: '⚠️ Aviso',
            description: 'A busca em lote encontrou um erro. Resultados parciais podem estar vazios.',
          })
        }
        
        // Processar resultados em lote
        const map: Record<string, Equipment[]> = {}
        
        for (const searchResult of batchData) {
          const desc = searchResult.query_original || ''
          if (!map[desc]) map[desc] = []
          
          for (const r of (searchResult.resultados || [])) {
            // Backend v4.0+ envia confidenceItem como 0-100 (percentual)
            const rawConfidence = r.confidenceItem ?? r.score_normalized ?? r.score ?? null
            const confidence = typeof rawConfidence === 'number' ? rawConfidence : null
            
            // Mapear métricas v4.0 se disponíveis
            const metrics = r.metrics ? {
              valorUnitario: r.metrics.valorUnitario,
              vidaUtilMeses: r.metrics.vidaUtilMeses,
              manutencao: r.metrics.manutencao
            } : undefined
            
            const sources = r.sources ? {
              fornecedores: r.sources.fornecedores,
              bids: r.sources.bids,
              nLinhas: r.sources.nLinhas ?? 0
            } : undefined
            
            map[desc].push({
              ranking: 0,
              sugeridos: r.sugeridos || r.descricao || r.grupo,
              equipmentId: r.equipmentId,
              title: r.title,
              valor_unitario: r.valor_unitario ?? metrics?.valorUnitario?.display ?? null,
              vida_util_meses: r.vida_util_meses ?? metrics?.vidaUtilMeses?.display ?? null,
              manutencao_percent: r.manutencao_percent ?? (metrics?.manutencao?.display ? metrics.manutencao.display * 100 : null),
              metrics,
              sources,
              confianca: confidence,
              link_detalhes: r.link_detalhes || '#',
              marca: r.marca ?? null,
              origemDescricao: desc,
            })
          }
        }
        const groups: Array<{ descricao: string; itens: Equipment[] }> = []
        Object.entries(map).forEach(([descricao, itens]) => {
          // Ordenação NUMÉRICA por confiança (descendente)
          const ordered = itens.sort((a, b) => {
            const confA = typeof a.confianca === 'number' ? a.confianca : 0
            const confB = typeof b.confianca === 'number' ? b.confianca : 0
            return confB - confA
          })
          ordered.forEach((it, idx) => (it.ranking = idx + 1))
          
          groups.push({ descricao, itens: ordered })
        })
        const orderedGroups = descricoes
          .filter(d => groups.find(g => g.descricao === d))
          .map(d => groups.find(g => g.descricao === d)!)
        setBatchGroups(orderedGroups)
      }

    } catch (error) {
      console.error('Erro na busca:', error)
      toast({
        title: "❌ Erro",
        description: "Falha na busca. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen relative">
      <InteractiveBackground />
      <CursorFollower />
      <SkipLinks />
      
      {/* Navbar profissional */}
      <Navbar 
        cartItemCount={cart.length}
        onCartClick={() => setCartOpen(true)}
      />
      
      <div className="app-container py-6 sm:py-10 lg:py-16" id="main-content">
        {/* Header premium com gradientes */}
        <div className="mb-6 sm:mb-12 lg:mb-16 px-2 sm:px-0 relative">
          {/* Efeito de luz gradiente */}
          <div className="hidden lg:block absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>
          
          <div className="text-center space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="space-y-3 sm:space-y-4 lg:space-y-6 animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
                Precificação de Equipamentos
              </h1>
              
              <p className="mx-auto max-w-3xl text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed font-medium px-2 sm:px-4">
                Descreva os equipamentos que precisa e receba sugestões com <span className="text-blue-600 font-bold">preço, vida útil e manutenção</span> — tudo com IA.
              </p>
            </div>
            
            {/* Feature badges - Apenas desktop (no mobile aparecem após a barra de busca) */}
            <div className="hidden sm:flex flex-wrap justify-center gap-2 sm:gap-3 animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-300/50 text-blue-700 shadow-md hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 cursor-default backdrop-blur-sm">
                <Zap className="h-4 w-4 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-bold">Busca Instantânea</span>
              </div>
              <div className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-300/50 text-blue-700 shadow-md hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 cursor-default backdrop-blur-sm">
                <TrendingUp className="h-4 w-4 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-bold">Análise Inteligente</span>
              </div>
              <div className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-300/50 text-blue-700 shadow-md hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 cursor-default backdrop-blur-sm">
                <Shield className="h-4 w-4 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-bold">Dados Confiáveis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section premium */}
        {!hasData && (
          <div className="mb-20 animate-fade-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="relative rounded-3xl border-2 border-dashed border-blue-300/40 bg-gradient-to-br from-white via-blue-50/30 to-white p-14 text-center card-glass hover:border-blue-400/60 transition-all duration-500 group overflow-hidden">
              {/* Efeito de brilho animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 via-blue-600/15 to-blue-500/20 mb-7 shadow-xl relative">
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping opacity-50"></div>
                  <Upload className="h-11 w-11 text-blue-600 relative z-10" />
                </div>
                <h3 className="text-2xl font-black mb-4 bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
                Carregue sua planilha
              </h3>
              <p className="text-muted-foreground mb-10 text-lg max-w-md mx-auto leading-relaxed">
                Faça upload de um arquivo Excel (.xlsx) com os dados dos equipamentos
              </p>
              <div className="flex flex-col items-center gap-5">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button 
                    asChild 
                    disabled={uploadingFile}
                    size="lg"
                    className="btn-interactive shadow-large hover:shadow-xl px-10 py-7 text-base font-bold tracking-wide"
                  >
                    <span className="flex items-center gap-3">
                      {uploadingFile ? (
                        <>
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                          Carregando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          Selecionar arquivo
                        </>
                      )}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground font-medium">Formatos aceitos: .xlsx (máx. 10MB)</p>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Input */}
        {hasData && (
          <div id="search" className="space-y-4 sm:space-y-8 animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
            <SearchInput onSearch={handleSearch} isLoading={isLoading} />
            
            {/* Feature badges - Apenas mobile (no desktop aparecem acima) */}
            <div className="flex sm:hidden flex-wrap justify-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-300/50 text-blue-700 shadow-sm">
                <Zap className="h-3 w-3" />
                <span className="text-xs font-semibold">Busca Instantânea</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-300/50 text-blue-700 shadow-sm">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs font-semibold">Análise IA</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100/80 border border-blue-300/50 text-blue-700 shadow-sm">
                <Shield className="h-3 w-3" />
                <span className="text-xs font-semibold">Dados Confiáveis</span>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} />
        
        {/* Loading State melhorado */}
        {isLoading && (
          <div className="mt-12 sm:mt-16 md:mt-20" id="results" role="status" aria-live="polite" aria-label="Carregando resultados">
            <LoadingState type="search" message="Analisando equipamentos..." />
            <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] 2xl:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
              {[1, 2, 3].map((i) => (
                <EquipmentCardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Results - Single */}
        {!isLoading && equipments.length > 0 && batchGroups.length === 0 && (
          <div id="results" className="mt-12 sm:mt-16 md:mt-20 animate-fade-slide-up" role="region" aria-live="polite" aria-label="Resultados da busca">
            <div className="mb-8 sm:mb-10 md:mb-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/85 bg-clip-text text-transparent">
                  Sugestões de Equipamentos
                </h2>
                <p className="text-muted-foreground mt-2 sm:mt-3 text-base sm:text-lg font-medium">Resultados baseados na sua descrição</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="inline-flex items-center gap-2 sm:gap-3 rounded-full bg-gradient-to-r from-blue-100 to-blue-50 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold text-blue-700 border border-blue-300 shadow-sm">
                  <span className="flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></span>
                  {equipments.length} {equipments.length === 1 ? "resultado" : "resultados"}
                </span>
              </div>
            </div>
            <HorizontalScroll itemMinWidth={240}>
              {equipments.map((equipment, index) => (
                <EquipmentCard
                  key={equipment.ranking}
                  equipment={equipment}
                  dense
                  selected={selected.has(itemId(equipment))}
                  onToggleSelect={() => {
                    const id = itemId(equipment)
                    setSelected(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next })
                  }}
                  onAdd={() => addToCart(equipment)}
                />
              ))}
            </HorizontalScroll>
          </div>
        )}

        {/* Results - Batch */}
        {!isLoading && batchGroups.length > 0 && (
          <div id="results" className="mt-12 sm:mt-16 md:mt-20 space-y-12 sm:space-y-14 md:space-y-16 animate-fade-slide-up" role="region" aria-live="polite" aria-label="Resultados da busca em lotes">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end gap-3">
              <Button 
                size="sm" 
                variant="outline" 
                className="btn-interactive shadow-soft hover:shadow-medium text-xs sm:text-sm"
                onClick={() => {
                  try {
                    const headers = [
                      'Descrição Original',
                      'Equipamento Sugerido',
                      'Valor Unitário',
                      'Vida Útil (meses)',
                      'Manutenção (%)',
                      'Confiança (%)'
                      
                    ]
                    const rows = (batchResults || []).map((r:any) => [
                      `"${r.descricao_original || ''}"`,
                      `"${r.sugerido || 'N/A'}"`,
                      r.valor_unitario ?? 'N/A',
                      r.vida_util_meses ?? 'N/A',
                      r.manutencao_percent ?? 'N/A',
                      r.confianca ?? 'N/A',
                      
                    ].join(','))
                    const csv = [headers.join(','), ...rows].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'resultados_busca_lote.csv'
                    a.click()
                    window.URL.revokeObjectURL(url)
                    toast({ title: '✅ Download iniciado', description: 'CSV gerado com sucesso' })
                  } catch (e) {
                    console.error(e)
                    toast({ title: '❌ Erro', description: 'Falha ao gerar CSV', variant: 'destructive' })
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar CSV
              </Button>
            </div>
            
            {batchGroups.map((group, gi) => {
              const sortKey = batchSortMap[group.descricao] || 'conf-desc'
              const sortedItems = [...group.itens].sort((a, b) => {
                switch (sortKey) {
                  case 'price-asc':
                    return (a.valor_unitario ?? Infinity) - (b.valor_unitario ?? Infinity)
                  case 'price-desc':
                    return (b.valor_unitario ?? -Infinity) - (a.valor_unitario ?? -Infinity)
                  case 'life-desc':
                    return (b.vida_util_meses ?? 0) - (a.vida_util_meses ?? 0)
                  case 'conf-asc': {
                    const confA = typeof a.confianca === 'number' ? a.confianca : 0
                    const confB = typeof b.confianca === 'number' ? b.confianca : 0
                    return confA - confB
                  }
                  case 'conf-desc':
                  default: {
                    const confA = typeof a.confianca === 'number' ? a.confianca : 0
                    const confB = typeof b.confianca === 'number' ? b.confianca : 0
                    return confB - confA
                  }
                }
              })
              sortedItems.forEach((it, idx) => (it.ranking = idx + 1))
              
              return (
                <section key={gi} className="space-y-6 sm:space-y-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 flex-wrap">
                    <div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent break-words">
                        Resultados para: "{group.descricao}"
                      </h2>
                      <p className="text-muted-foreground mt-1.5 sm:mt-2 text-base sm:text-lg">
                        {group.itens.length} {group.itens.length === 1 ? 'sugestão' : 'sugestões'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <label htmlFor={`sort-${gi}`} className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
                        Ordenar por
                      </label>
                      <select
                        id={`sort-${gi}`}
                        value={sortKey}
                        onChange={(e) => setBatchSortMap((m) => ({ ...m, [group.descricao]: e.target.value }))}
                        className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-border bg-card/50 text-xs sm:text-sm font-medium shadow-soft hover:shadow-medium focus-ring transition-all backdrop-blur-sm"
                      >
                        <option value="conf-desc">Maior confiança</option>
                        <option value="conf-asc">Menor confiança</option>
                        <option value="price-asc">Menor preço</option>
                        <option value="price-desc">Maior preço</option>
                        <option value="life-desc">Maior vida útil</option>
                      </select>
                    </div>
                  </div>
                  <HorizontalScroll itemMinWidth={230}>
                    {sortedItems.map((equipment, index) => (
                      <EquipmentCard
                        key={`${group.descricao}-${equipment.sugeridos}-${index}`}
                        equipment={equipment}
                        dense
                        selected={selected.has(itemId(equipment))}
                        onToggleSelect={() => {
                          const id = itemId(equipment)
                          setSelected(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next })
                        }}
                        onAdd={() => addToCart(equipment)}
                      />
                    ))}
                  </HorizontalScroll>
                </section>
              )
            })}
          </div>
        )}

        {/* Empty State melhorado */}
        {!isLoading && hasData && equipments.length === 0 && batchGroups.length === 0 && lastQuery && (
          <EmptyState 
            type="no-results" 
            lastQuery={lastQuery}
          />
        )}
        
        {!isLoading && hasData && equipments.length === 0 && batchGroups.length === 0 && !lastQuery && (
          <EmptyState type="no-search" />
        )}
      </div>

      {/* Footer profissional AFM Performance */}
      <footer className="border-t border-slate-200 bg-slate-50 mt-20 sm:mt-24">
        <div className="app-container py-8 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Logo e Sobre */}
            <div className="flex flex-col items-center md:items-start">
              <Image
                src="/logo-performance-horizontal-azul.png"
                alt="AFM Performance"
                width={100}
                height={30}
                className="h-8 w-auto mb-4"
              />
              <p className="text-sm text-slate-600 text-center md:text-left leading-relaxed">
                Soluções inteligentes para precificação de equipamentos
              </p>
            </div>
            
            {/* Links */}
            <div className="flex flex-col items-center">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Links</h3>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600">
                <InfoModal 
                  trigger="Sobre"
                  title="Sobre a Ferramenta"
                  content={`O AFM Precificação de Equipamentos é uma ferramenta inteligente desenvolvida para auxiliar na estimativa de custos, vida útil e manutenção de equipamentos de limpeza.

Utilizando algoritmos avançados e uma base de dados atualizada, fornecemos insights precisos para otimizar seu planejamento financeiro e operacional.`}
                />
                <span className="text-slate-300">•</span>
                <InfoModal 
                  trigger="Contato"
                  title="Fale Conosco"
                  content={`Entre em contato conosco para dúvidas, sugestões ou suporte:

Email: kaike.costa@atlasinovacoes.com.br`}
                />
                <span className="text-slate-300">•</span>
                <InfoModal 
                  trigger="Termos"
                  title="Termos de Uso"
                  content={`1. O uso desta ferramenta é para fins estimativos.

2. Os valores apresentados são baseados em médias de mercado e podem variar.

3. A AFM Performance não se responsabiliza por decisões tomadas exclusivamente com base nestes dados.

4. Todos os direitos reservados.`}
                />
              </div>
            </div>
            
            {/* Copyright e Powered */}
            <div className="flex flex-col items-center md:items-end">
              <p className="text-sm text-slate-600 font-semibold mb-2">
                © 2025 AFM Performance
              </p>
              <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold">
                <span>Powered by</span>
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>dados</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <CartWidget
        items={cart}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onClear={clearCart}
        onRemove={removeFromCart}
        onChangeQty={changeQty}
        onChangeNotes={changeNotes}
        onChangeName={changeName}
      />
    </main>
  )
}
