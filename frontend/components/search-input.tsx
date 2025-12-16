"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Search, Loader2, Send, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

// Custom hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface SearchOptions {
  topK: number
  useTfidf: boolean
}

interface SearchInputProps {
  onSearch: (description: string, options: SearchOptions) => void
  isLoading: boolean
}

const PLACEHOLDER_EXAMPLES = [
  "Descreva um equipamento...",
  "Ex: vassoura profissional",
  "Ex: aspirador de pó",
  "Ex: mop industrial",
  "Ex: lavadora de piso",
  "Ex: enceradeira 350mm",
]

export function SearchInput({ onSearch, isLoading }: SearchInputProps) {
  const [value, setValue] = useState("")
  const [topK, setTopK] = useState(5)
  const [useTfidf] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Estados para o efeito de máquina de escrever
  const [placeholderText, setPlaceholderText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [loopNum, setLoopNum] = useState(0)
  const [typingSpeed, setTypingSpeed] = useState(100)

  // Efeito de digitação (Typewriter)
  useEffect(() => {
    if (value.trim().length > 0) return // Pausa animação se usuário digitar

    const i = loopNum % PLACEHOLDER_EXAMPLES.length
    const fullText = PLACEHOLDER_EXAMPLES[i]

    const handleTyping = () => {
      setPlaceholderText(current => {
        if (isDeleting) {
          setTypingSpeed(40) // Mais rápido ao apagar
          if (current === "") {
            setIsDeleting(false)
            setLoopNum(prev => prev + 1)
            setTypingSpeed(100)
            return ""
          }
          return current.slice(0, -1)
        } else {
          setTypingSpeed(100) // Normal ao digitar
          if (current === fullText) {
            setTypingSpeed(2000) // Pausa ao terminar
            setIsDeleting(true)
            return current
          }
          return fullText.slice(0, current.length + 1)
        }
      })
    }

    const timer = setTimeout(handleTyping, typingSpeed)
    return () => clearTimeout(timer)
  }, [placeholderText, isDeleting, loopNum, value, typingSpeed])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !isLoading) {
      onSearch(value.trim(), { topK, useTfidf })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault()
      if (value.trim() && !isLoading) {
        onSearch(value.trim(), { topK, useTfidf })
      }
    }
  }

  // Auto-ajuste da altura do textarea
  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  useEffect(() => {
    autoResize()
  }, [value])

  return (
    <div className="w-full max-w-3xl mx-auto px-2 sm:px-4">
      <form onSubmit={handleSubmit} className="group">
        <div className="relative rounded-2xl min-[640px]:rounded-3xl bg-white backdrop-blur-md border border-slate-200/80 shadow-lg ring-0 transition-all duration-300 hover:shadow-2xl hover:border-blue-200 focus-within:shadow-2xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
          {/* Ícone da lupa (centralizado verticalmente) */}
          <div className="pointer-events-none absolute left-3 min-[640px]:left-6 top-1/2 -translate-y-1/2 flex items-center">
            <Search className="h-5 w-5 min-[640px]:h-5 min-[640px]:w-5 text-slate-400 transition-colors group-focus-within:text-blue-600" />
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            rows={1}
            className="w-full rounded-2xl min-[640px]:rounded-3xl bg-transparent min-h-[3.25rem] min-[640px]:min-h-[4rem] px-4 pl-10 min-[640px]:pl-16 pr-20 min-[640px]:pr-36 py-3.5 min-[640px]:py-5 text-base min-[640px]:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium transition-all resize-none overflow-hidden leading-relaxed whitespace-nowrap text-ellipsis"
            disabled={isLoading}
          />

          {/* Ações (centralizadas verticalmente). Mobile menor para não cobrir o texto */}
          <div className="absolute right-2 min-[640px]:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 min-[640px]:gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="!p-0 !h-8 !w-8 min-[640px]:!h-10 min-[640px]:!w-10 rounded-full transition-all duration-300 hover:scale-105 flex items-center justify-center bg-transparent border-0 shadow-none min-[640px]:border min-[640px]:border-slate-200 min-[640px]:bg-white min-[640px]:shadow-sm min-[640px]:hover:bg-slate-50 min-[640px]:hover:border-blue-300"
                    aria-label="Configurar quantidade de sugestões"
                    title="Configurações"
                    onClick={() => setShowOptions((v) => !v)}
                  >
                    <Settings className="h-5 w-5 min-[640px]:h-5 min-[640px]:w-5 text-slate-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Ajustar quantidade de sugestões
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              type="submit"
              disabled={!value.trim() || isLoading}
              className="!p-0 !h-8 !w-8 min-[640px]:!h-11 min-[640px]:!w-11 rounded-full transition-all duration-300 hover:scale-105 flex items-center justify-center bg-transparent shadow-none text-blue-600 min-[640px]:bg-gradient-to-br min-[640px]:from-blue-600 min-[640px]:to-blue-700 min-[640px]:text-white min-[640px]:shadow-lg min-[640px]:hover:shadow-xl focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-blue-500 hover:bg-transparent active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enviar busca"
              title="Enviar (Ctrl + Enter)"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 min-[640px]:h-5 min-[640px]:w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 min-[640px]:h-5 min-[640px]:w-5 ml-0.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex justify-end px-4 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300">
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium hidden sm:inline-block">
            Pressione <kbd className="font-sans px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-500">Ctrl</kbd> + <kbd className="font-sans px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-500">Enter</kbd> para enviar
          </span>
        </div>
      </form>

      {/* Search Options */}
      {showOptions && (
        <div className="mt-5 rounded-2xl bg-white border-2 border-slate-200 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="space-y-5 flex-1">
              <div className="text-sm text-slate-600 font-medium leading-relaxed">
                Busca Semântica com IA • Vetorização de Embeddings • Re-ranking Inteligente
              </div>

              <div className="space-y-3">
                <Label htmlFor="topk" className="text-sm font-semibold text-slate-900">
                  Quantidade de sugestões: {topK}
                </Label>
                <input
                  id="topk"
                  type="range"
                  min="1"
                  max="10"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-slate-100 hover:bg-slate-200 transition-colors accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 sm:mt-7 text-center space-y-2 sm:space-y-3 hidden sm:block">
        <p className="text-sm text-slate-600 font-medium">
          💡 <strong className="font-semibold">Dica:</strong> Pressione <kbd className="px-2.5 py-1.5 bg-slate-100 rounded-md text-xs font-mono font-semibold border border-slate-200 shadow-sm">Enter</kbd> para quebrar linha, <kbd className="px-2.5 py-1.5 bg-slate-100 rounded-md text-xs font-mono font-semibold border border-slate-200 shadow-sm">Ctrl+Enter</kbd> para buscar
        </p>
        <p className="text-xs text-slate-500 font-medium">
          Separe múltiplos equipamentos por: vírgula (,), ponto-e-vírgula (;) ou quebra de linha
        </p>
      </div>
    </div>
  )
}