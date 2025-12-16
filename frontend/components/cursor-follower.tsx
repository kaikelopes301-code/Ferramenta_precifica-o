"use client"

import { useEffect, useRef } from 'react'

export function CursorFollower() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Só ativa em dispositivos com mouse (desktop)
    if (window.matchMedia('(hover: none)').matches) {
      return
    }

    const cursor = cursorRef.current
    if (!cursor) return

    let mouseX = 0
    let mouseY = 0
    let cursorX = 0
    let cursorY = 0
    const speed = 0.15 // Suavidade do movimento

    // Atualizar posição do mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    // Animação suave do cursor
    const animate = () => {
      // Interpolação suave
      cursorX += (mouseX - cursorX) * speed
      cursorY += (mouseY - cursorY) * speed

      if (cursor) {
        cursor.style.left = `${cursorX}px`
        cursor.style.top = `${cursorY}px`
      }

      requestAnimationFrame(animate)
    }

    // Estados hover/click
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Verificação de segurança para evitar erros em elementos que não suportam getAttribute (ex: document, window)
      if (!target || typeof target.getAttribute !== 'function') return

      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.getAttribute('role') === 'button' ||
        target.closest('a, button, [role="button"]')
      ) {
        cursor?.classList.add('hover')
      }
    }

    const handleMouseLeave = () => {
      cursor?.classList.remove('hover')
    }

    const handleMouseDown = () => {
      cursor?.classList.add('click')
    }

    const handleMouseUp = () => {
      cursor?.classList.remove('click')
    }

    // Event listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseenter', handleMouseEnter, true)
    document.addEventListener('mouseleave', handleMouseLeave, true)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    // Iniciar animação
    const animationId = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseenter', handleMouseEnter, true)
      document.removeEventListener('mouseleave', handleMouseLeave, true)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div
      ref={cursorRef}
      id="cursor-follower"
      className="hidden sm:block" // Mostra em telas maiores que mobile (sm), JS controla hover
      aria-hidden="true"
    />
  )
}
