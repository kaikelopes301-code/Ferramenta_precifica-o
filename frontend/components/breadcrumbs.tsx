"use client"

import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { Fragment } from "react"

interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  showHome?: boolean
}

export function Breadcrumbs({ items, showHome = true }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 sm:mb-8">
      <ol className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm">
        {/* Home */}
        {showHome && (
          <>
            <li>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
                aria-label="Ir para página inicial"
              >
                <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Início</span>
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/50" />
            </li>
          </>
        )}

        {/* Breadcrumb items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const isCurrent = item.current || isLast

          return (
            <Fragment key={index}>
              <li>
                {item.href && !isCurrent ? (
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1 inline-block font-medium"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={`${
                      isCurrent 
                        ? 'text-foreground font-bold' 
                        : 'text-muted-foreground'
                    } px-2 py-1 inline-block`}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/50" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
