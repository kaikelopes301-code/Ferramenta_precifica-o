"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavbarProps {
  cartItemCount: number
  onCartClick: () => void
}

export function Navbar({ cartItemCount, onCartClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav 
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        isScrolled 
          ? "bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm" 
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="app-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex-shrink-0"
            aria-label="AFM Performance - Página inicial"
          >
            <Image
              src="/logo-performance-horizontal-azul.png"
              alt="AFM Performance"
              width={140}
              height={40}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          {/* Cart Button */}
          <Button
            onClick={onCartClick}
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full hover:bg-slate-100 text-slate-700 hover:text-blue-600 transition-colors"
            aria-label={`Carrinho com ${cartItemCount} ${cartItemCount === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
            
            {/* Badge */}
            {cartItemCount > 0 && (
              <span 
                className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </nav>
  )
}
