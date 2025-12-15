import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background gap-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-card shadow-lg border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
      <p className="text-muted-foreground animate-pulse font-medium">Carregando...</p>
    </div>
  )
}