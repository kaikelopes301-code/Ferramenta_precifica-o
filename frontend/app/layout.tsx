import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from "sonner"
import './globals.css'
import Metrics from "@/components/metrics"

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'sans-serif'],
  adjustFontFallback: true
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://precificacao.afmperformance.com.br'),
  title: {
    default: 'AFM Performance - Precificação de Equipamentos',
    template: '%s | AFM Performance'
  },
  description: 'Sistema de precificação inteligente para equipamentos de limpeza profissional. Busca com IA, análise de preços, vida útil e manutenção em tempo real.',
  keywords: ['precificação', 'equipamentos', 'limpeza profissional', 'IA', 'AFM Performance', 'cotação', 'orçamento', 'materiais de limpeza', 'equipamentos industriais'],
  authors: [{ name: 'AFM Performance', url: 'https://afmperformance.com.br' }],
  creator: 'AFM Performance',
  publisher: 'AFM Performance',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://precificacao.afmperformance.com.br',
    siteName: 'AFM Performance',
    title: 'AFM Performance - Precificação de Equipamentos',
    description: 'Sistema de precificação inteligente para equipamentos de limpeza profissional com IA.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AFM Performance - Precificação de Equipamentos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AFM Performance - Precificação de Equipamentos',
    description: 'Sistema de precificação inteligente para equipamentos de limpeza profissional com IA.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ],
  colorScheme: 'light'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-br" className="scroll-smooth">
      <body className={`${inter.className} antialiased bg-white text-slate-900`}>
        {children}
        <Toaster 
          position="top-right"
          duration={3000}
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#1e293b',
              border: '1px solid #e2e8f0',
            },
          }}
        />
        {/* Métricas de Web Vitals (leve, sem mudar UI) */}
        <Metrics />
      </body>
    </html>
  )
}
