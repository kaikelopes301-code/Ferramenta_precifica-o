import { normalizeText } from '../../utils/textNormalization.js'
import type { DocCategory, NavigationIntentContext } from '../semantic/taxonomy.js'

export interface DiversifyDocInput {
  id: string
  title: string
  groupId: string
  equipmentId?: string
  docCategory?: string
  rankScore: number
}

export interface DiversifyConfig {
  topK: number
  maxPerSubtype: number
  minCategoryCoverage: number
}

const STOPWORDS = new Set<string>(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'sem', 'e'])

function categoryTokenFor(category: DocCategory | null): string | null {
  if (!category) return null
  if (category === 'MOP') return 'mop'
  if (category === 'VASSOURA') return 'vassoura'
  return null
}

export function buildSubtypeKey(doc: Pick<DiversifyDocInput, 'title' | 'groupId' | 'equipmentId'>, category: DocCategory | null): string {
  const baseRaw = doc.title || doc.groupId
  const base = normalizeText(baseRaw)
  const tokens = base.split(' ').filter(Boolean)
  const catToken = categoryTokenFor(category)

  const filtered = tokens.filter((t) => {
    if (!t) return false
    if (STOPWORDS.has(t)) return false
    if (catToken && t === catToken) return false
    return true
  })

  const subtype = filtered.join(' ').trim()
  if (subtype) return subtype

  return normalizeText(doc.equipmentId || doc.groupId) || doc.groupId
}

export function diversifyBySubtype(
  docsSorted: DiversifyDocInput[],
  ctx: NavigationIntentContext,
  cfg: DiversifyConfig
): { selected: DiversifyDocInput[]; subtypeKeyById: Map<string, string>; primaryPoolCount: number; uniqueSubtypeCountPrimary: number } {
  const topK = Math.max(1, cfg.topK)
  const maxPerSubtype = Math.max(1, cfg.maxPerSubtype)
  const minCoverage = Math.max(0, Math.min(cfg.minCategoryCoverage, topK))

  const subtypeKeyById = new Map<string, string>()
  for (const d of docsSorted) {
    subtypeKeyById.set(d.id, buildSubtypeKey(d, ctx.queryCategory))
  }

  const primaryPool = ctx.queryCategory
    ? docsSorted.filter((d) => d.docCategory === ctx.queryCategory)
    : []
  const primaryPoolCount = primaryPool.length

  const uniqueSubtypePrimary = new Set<string>()
  for (const d of primaryPool) {
    const k = subtypeKeyById.get(d.id) || ''
    if (k) uniqueSubtypePrimary.add(k)
  }

  const uniqueSubtypeCountPrimary = uniqueSubtypePrimary.size

  const selected: DiversifyDocInput[] = []
  const selectedIds = new Set<string>()
  const subtypeCounts = new Map<string, number>()

  const trySelect = (d: DiversifyDocInput, enforceMaxPerSubtype: boolean): boolean => {
    if (selectedIds.has(d.id)) return false
    const key = subtypeKeyById.get(d.id) || d.id
    if (enforceMaxPerSubtype) {
      const c = subtypeCounts.get(key) ?? 0
      if (c >= maxPerSubtype) return false
    }
    selected.push(d)
    selectedIds.add(d.id)
    const c2 = subtypeCounts.get(key) ?? 0
    subtypeCounts.set(key, c2 + 1)
    return true
  }

  // (4) Garantia de cobertura mínima dentro da categoria
  if (ctx.queryCategory && primaryPoolCount >= minCoverage && minCoverage > 0) {
    for (const d of primaryPool) {
      trySelect(d, true)
      if (selected.length >= minCoverage) break
    }
  }

  // (3) Seleção diversificada por subtype (ordem por rankScore)
  for (const d of docsSorted) {
    if (selected.length >= topK) break
    // Prioridade: pool primário primeiro, mas sem bloquear o restante
    if (ctx.queryCategory && d.docCategory !== ctx.queryCategory && selected.length < minCoverage) continue
    trySelect(d, true)
  }

  // (3) Fallback: preencher com próximos docs mesmo repetindo subtype
  if (selected.length < topK) {
    for (const d of docsSorted) {
      if (selected.length >= topK) break
      if (selectedIds.has(d.id)) continue
      // Mantém cobertura mínima antes de puxar fora da categoria
      if (ctx.queryCategory && d.docCategory !== ctx.queryCategory && selected.length < minCoverage) continue
      trySelect(d, false)
    }
  }

  return { selected, subtypeKeyById, primaryPoolCount, uniqueSubtypeCountPrimary }
}
