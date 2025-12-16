"use client"

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-[9999] inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold shadow-xl focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all hover:scale-105"
      >
        Pular para o conteúdo principal
      </a>
      <a
        href="#search"
        className="fixed top-4 left-4 z-[9999] inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold shadow-xl focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all hover:scale-105"
      >
        Pular para a busca
      </a>
      <a
        href="#results"
        className="fixed top-4 left-4 z-[9999] inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold shadow-xl focus:outline-none focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all hover:scale-105"
      >
        Pular para os resultados
      </a>
    </div>
  )
}
