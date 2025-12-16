"use client"

import { useRef, useState, useEffect } from "react"

interface HorizontalScrollProps {
  children: React.ReactNode
  itemMinWidth?: number // px
}

export function HorizontalScroll({ children, itemMinWidth = 280 }: HorizontalScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  
  // Efeito de entrada (fade-in escalonado)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    
    const items = el.querySelectorAll('[data-item]')
    items.forEach((item, i) => {
      (item as HTMLElement).style.animationDelay = `${i * 100}ms`
    })
  }, [])

  return (
    <div className="relative -mx-4 sm:mx-0 group">
      {/* Container de scroll nativo */}
      <div
        ref={ref}
        className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 px-4 sm:px-1 snap-x snap-mandatory hide-scrollbar scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div
                key={i}
                className="snap-center shrink-0"
                style={{ minWidth: `${itemMinWidth}px` }}
              >
                <div className="animate-fade-slide-up" data-item>
                  {child}
                </div>
              </div>
            ))
          : (
            <div className="snap-center shrink-0" style={{ minWidth: `${itemMinWidth}px` }}>
              <div className="animate-fade-slide-up" data-item>{children}</div>
            </div>
          )}
          
        {/* Spacer final para garantir que o último item não fique colado na borda */}
        <div className="w-2 sm:w-0 shrink-0" />
      </div>
      
      {/* Indicadores de gradiente opcionais para desktop */}
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none opacity-0 sm:opacity-100 transition-opacity" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none opacity-0 sm:opacity-100 transition-opacity" />
    </div>
  )
}
