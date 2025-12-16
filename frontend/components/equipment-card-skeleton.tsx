"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

interface EquipmentCardSkeletonProps {
  dense?: boolean
}

export function EquipmentCardSkeleton({ dense }: EquipmentCardSkeletonProps) {
  return (
    <Card
      className={`group relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card/99 to-card/97 shadow-medium animate-pulse ${
        dense ? 'w-full sm:min-w-[220px] md:min-w-[240px]' : 'w-full sm:min-w-[260px] md:min-w-[280px] lg:min-w-[300px]'
      }`}
    >
      {/* Gradiente decorativo no topo */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-muted/0 via-muted/50 to-muted/0"></div>

      <CardHeader className={`${dense ? 'space-y-2 pb-3 pt-4' : 'space-y-3 pb-4 pt-5'} relative`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            {/* Ranking badge skeleton */}
            <div className="skeleton h-7 w-16 rounded-full"></div>

            {/* Nome do equipamento skeleton */}
            <div className="space-y-2">
              <div className="skeleton h-5 w-full rounded"></div>
              <div className="skeleton h-5 w-3/4 rounded"></div>
            </div>

            {/* Marca skeleton */}
            <div className="skeleton h-6 w-24 rounded-full"></div>
          </div>

          {/* Checkbox skeleton */}
          <div className="skeleton h-6 w-6 rounded-md"></div>
        </div>
      </CardHeader>

      <CardContent className={`${dense ? 'space-y-3 pb-3' : 'space-y-4 pb-4'}`}>
        {/* Preço skeleton */}
        <div className={`relative overflow-hidden rounded-2xl bg-muted/30 ${dense ? 'p-4' : 'p-5'}`}>
          <div className="flex items-center gap-4">
            <div className={`skeleton ${dense ? 'h-12 w-12' : 'h-16 w-16'} rounded-xl`}></div>
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-20 rounded"></div>
              <div className="skeleton h-7 w-32 rounded"></div>
              <div className="skeleton h-2 w-24 rounded"></div>
            </div>
          </div>
        </div>

        {/* Grid de estatísticas skeleton */}
        <div className={`grid grid-cols-2 ${dense ? 'gap-3' : 'gap-4'}`}>
          <div className={`rounded-xl border border-border/60 bg-muted/10 ${dense ? 'p-3' : 'p-4'}`}>
            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded"></div>
              <div className="skeleton h-6 w-16 rounded"></div>
              <div className="skeleton h-3 w-20 rounded"></div>
            </div>
          </div>
          
          <div className={`rounded-xl border border-border/60 bg-muted/10 ${dense ? 'p-3' : 'p-4'}`}>
            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded"></div>
              <div className="skeleton h-6 w-16 rounded"></div>
              <div className="skeleton h-3 w-20 rounded"></div>
            </div>
          </div>
        </div>

        {/* Manutenção skeleton */}
        <div className={`rounded-xl border border-muted/30 bg-muted/10 ${dense ? 'p-3' : 'p-4'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="skeleton h-8 w-8 rounded-lg"></div>
              <div className="space-y-1">
                <div className="skeleton h-4 w-20 rounded"></div>
                <div className="skeleton h-3 w-28 rounded"></div>
              </div>
            </div>
            <div className="skeleton h-7 w-16 rounded-full"></div>
          </div>
        </div>
      </CardContent>

      <CardFooter className={`${dense ? 'pt-0 pb-3 sm:pb-4 px-3 sm:px-4' : 'pt-0 pb-4 sm:pb-5 px-4 sm:px-5'} flex gap-2 sm:gap-2.5`}>
        <div className="skeleton h-10 flex-1 rounded-lg"></div>
        <div className="skeleton h-10 w-10 rounded-lg"></div>
      </CardFooter>

      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
    </Card>
  )
}
