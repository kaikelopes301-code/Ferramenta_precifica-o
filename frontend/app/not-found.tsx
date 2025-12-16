import Link from "next/link"
import { Metadata } from "next"
import { Home, Search, ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "A página que você está procurando não existe ou foi movida.",
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-4">
      <div className="text-center max-w-lg mx-auto">
        {/* Ilustração animada */}
        <div className="relative mb-8">
          <div className="text-[120px] sm:text-[150px] font-black text-transparent bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 bg-clip-text leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 text-[120px] sm:text-[150px] font-black text-blue-500/10 blur-xl leading-none select-none" aria-hidden="true">
            404
          </div>
        </div>
        
        {/* Mensagem */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
          Página não encontrada
        </h1>
        <p className="text-slate-600 text-base sm:text-lg mb-8 leading-relaxed">
          Ops! A página que você está procurando não existe, foi removida ou está temporariamente indisponível.
        </p>
        
        {/* Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Voltar ao Início
          </Link>
          
          <Link
            href="/#search"
            className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-semibold hover:border-blue-300 hover:text-blue-600 hover:shadow-md transition-all duration-300"
          >
            <Search className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Fazer uma Busca
          </Link>
        </div>
        
        {/* Dica */}
        <p className="mt-10 text-sm text-slate-500">
          Se você acredita que isso é um erro, entre em contato conosco.
        </p>
      </div>
    </div>
  )
}
