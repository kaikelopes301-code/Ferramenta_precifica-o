import { performance } from 'node:perf_hooks'
import { normalizeText } from '../utils/textNormalization.js'
import { detectCategory } from './semantic/taxonomy.js'

export type AbbrevCompiled = {
  exactMap: Record<string, string>
  tokenMap: Record<string, string>
  expandMap: Record<string, string[]>
}

export type QueryVariant = {
  query: string
  weight: number
  reason: 'primary' | 'exactMap' | 'tokenMap' | 'expandMap'
}

export type QueryPlan = {
  original: string
  normalized: string
  primary: string
  variants: QueryVariant[]
  usedExpandMap: boolean
  rewriteTimeMs: number
}

export type RewriteOptions = {
  maxVariantsTotal?: number
  maxExpandItems?: number
  enableExpandMap?: boolean
}

const DEFAULT_REWRITE_OPTIONS: Required<RewriteOptions> = {
  maxVariantsTotal: 10,
  maxExpandItems: 8,
  enableExpandMap: true,
}

function hasDigits(text: string): boolean {
  return /\d/.test(text)
}

function isGenericSingleToken(query: string): boolean {
  const tokens = query.split(' ').filter(Boolean)
  if (tokens.length !== 1) return false
  if (tokens[0].length < 2) return false
  if (hasDigits(tokens[0])) return false
  return true
}

function isCategorySingleToken(query: string): boolean {
  const tokens = query.split(' ').filter(Boolean)
  if (tokens.length !== 1) return false
  return detectCategory(tokens[0]) !== 'UNKNOWN'
}

function applyTokenMap(query: string, tokenMap: Record<string, string>): { rewritten: string; changed: boolean } {
  const tokens = query.split(' ').filter(Boolean)
  let changed = false
  const rewrittenTokens = tokens.map((t) => {
    const mapped = tokenMap[t]
    if (mapped && mapped !== t) {
      changed = true
      return mapped
    }
    return t
  })
  return { rewritten: rewrittenTokens.join(' '), changed }
}

export function rewriteQuery(
  original: string,
  compiled: AbbrevCompiled | null,
  options: RewriteOptions = {}
): QueryPlan {
  const opts = { ...DEFAULT_REWRITE_OPTIONS, ...options }

  const t0 = performance.now()

  const normalized = normalizeText(original)
  let primary = normalized

  const variants: QueryVariant[] = []
  let usedExpandMap = false

  if (compiled) {
    const exact = compiled.exactMap[primary]
    if (exact && exact !== primary) {
      const exactNorm = normalizeText(exact)
      // Para categoria (ex.: "vassoura"), não substituir o termo base por um subtipo.
      // Mantém recall e permite diversificação posterior.
      if (isCategorySingleToken(primary)) {
        if (exactNorm && exactNorm !== primary) {
          variants.push({ query: exactNorm, weight: 0.6, reason: 'exactMap' })
        }
      } else {
        primary = exactNorm
        variants.push({ query: primary, weight: 1.0, reason: 'exactMap' })
      }
    }

    const tokenApplied = applyTokenMap(primary, compiled.tokenMap)
    if (tokenApplied.changed) {
      const tokenNorm = normalizeText(tokenApplied.rewritten)
      if (isCategorySingleToken(primary)) {
        if (tokenNorm && tokenNorm !== primary) {
          variants.push({ query: tokenNorm, weight: 0.6, reason: 'tokenMap' })
        }
      } else {
        primary = tokenNorm
        variants.push({ query: primary, weight: 1.0, reason: 'tokenMap' })
      }
    }

    if (opts.enableExpandMap && isGenericSingleToken(primary)) {
      const expandItems = compiled.expandMap[primary]
      if (Array.isArray(expandItems) && expandItems.length > 0) {
        usedExpandMap = true
        for (const item of expandItems.slice(0, opts.maxExpandItems)) {
          const q = normalizeText(item)
          if (!q || q === primary) continue
          variants.push({ query: q, weight: 0.6, reason: 'expandMap' })
          if (variants.length >= opts.maxVariantsTotal - 1) break
        }
      }
    }
  }

  // Ensure primary variant is always first and present
  const finalVariants: QueryVariant[] = [{ query: primary, weight: 1.0, reason: 'primary' }]

  // Deduplicate by query, preserving first occurrence (primary wins)
  const seen = new Set<string>([primary])
  for (const v of variants) {
    if (seen.has(v.query)) continue
    seen.add(v.query)
    finalVariants.push(v)
    if (finalVariants.length >= opts.maxVariantsTotal) break
  }

  const t1 = performance.now()
  return {
    original,
    normalized,
    primary,
    variants: finalVariants,
    usedExpandMap,
    rewriteTimeMs: t1 - t0,
  }
}
