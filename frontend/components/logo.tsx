"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface LogoProps {
  className?: string
  width?: number
  height?: number
}

export function Logo({ className = "", width = 260, height = 76 }: LogoProps) {
  const { theme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Evita flash de conteúdo errado
  if (!mounted) {
    return <div className={className} style={{ width, height }} />
  }

  const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  // SVG inline otimizado - muito menor que PNG
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 76"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Atlas Inovações"
    >
      {/* Símbolo Atlas */}
      <circle 
        cx="38" 
        cy="38" 
        r="34" 
        fill={isDark ? "#3b82f6" : "#2563eb"}
        opacity="0.1"
      />
      <path
        d="M38 8 L48 28 L68 28 L52 42 L58 62 L38 48 L18 62 L24 42 L8 28 L28 28 Z"
        fill={isDark ? "#60a5fa" : "#3b82f6"}
      />
      
      {/* Texto ATLAS */}
      <text
        x="85"
        y="42"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="28"
        fontWeight="900"
        letterSpacing="-0.5"
        fill={isDark ? "#f8fafc" : "#0f172a"}
      >
        ATLAS
      </text>
      
      {/* Texto Inovações */}
      <text
        x="85"
        y="62"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="14"
        fontWeight="600"
        letterSpacing="0.5"
        fill={isDark ? "#94a3b8" : "#64748b"}
      >
        INOVAÇÕES
      </text>
    </svg>
  )
}
