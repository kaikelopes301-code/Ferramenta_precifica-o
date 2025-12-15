import { normalizeText } from '../../utils/textNormalization.js'

export type DocCategory = 'MOP' | 'VASSOURA' | 'UNKNOWN'

export type DocType = 'EQUIPAMENTO' | 'ACESSORIO' | 'INDEFINIDO'

export type QueryIntent = 'EQUIPAMENTO' | 'ACESSORIO' | 'INDEFINIDO'

export interface NavigationIntentContext {
  queryRaw: string
  queryNormalized: string
  tokens: string[]
  numbers: string[]
  /** Tokens remanescentes (atributos) após remover categoria/stopwords/números/termos de acessório */
  attributes: string[]
  accessoryTerms: string[]
  /** Categoria detectada na query (null quando UNKNOWN) */
  queryCategory: DocCategory | null
  /** Termos com padrão de modelo/medida (ex.: 60cm, 220v, 62l, 510) */
  modelOrMeasureTerms: string[]
}

export const ACCESSORY_TERMS = new Set<string>([
  'disco',
  'discos',
  'escova',
  'escovas',
  'refil',
  'refis',
  'bocal',
  'saco',
  'filtro',
  'mangueira',
  'pano',
  'flanela',
  'esponja',
  'cabo',
  'adaptador',
  'kit',
  'suporte',
  'pinca',
  'pinça',
])

const STOPWORDS = new Set<string>([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'para',
  'pra',
  'com',
  'sem',
  'e',
  'a',
  'o',
  'as',
  'os',
  'em',
  'no',
  'na',
  'nos',
  'nas',
])

function tokenizeNormalized(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean)
}

function extractNumbers(tokens: string[]): string[] {
  const out: string[] = []
  for (const t of tokens) {
    if (/^\d+(?:[.,]\d+)?$/u.test(t)) out.push(t)
  }
  return out
}

function extractModelOrMeasureTerms(normalized: string, tokens: string[]): string[] {
  const terms = new Set<string>()

  // Exemplos: 60cm, 220v, 62l, 1400w, 1.5hp, 7,5l
  for (const t of tokens) {
    if (/\d/u.test(t) && /[a-z]/iu.test(t)) {
      if (/^\d+(?:[.,]\d+)?(?:mm|cm|m|l|lt|litros|v|volts|w|watts|kg|g|hp|rpm)$/iu.test(t)) {
        terms.add(t)
      } else if (/^\d{2,}[a-z]+$/iu.test(t) || /^[a-z]+\d{2,}$/iu.test(t)) {
        terms.add(t)
      }
    }
  }

  // Tokens numéricos "de modelo" (>=3 dígitos) isolados: 510, 1200
  for (const t of tokens) {
    if (/^\d{3,}$/u.test(t)) terms.add(t)
  }

  // Medidas explícitas separadas por espaço (ex.: "60 cm")
  if (/\b\d+(?:[.,]\d+)?\s*(mm|cm|m|l|lt|litros|v|volts|w|watts|kg|g|hp|rpm)\b/iu.test(normalized)) {
    // Não tentamos extrair todos, apenas sinalizamos que existe
    terms.add('measure')
  }

  return Array.from(terms)
}

function categoryTokenFor(category: DocCategory | null): string | null {
  if (!category) return null
  if (category === 'MOP') return 'mop'
  if (category === 'VASSOURA') return 'vassoura'
  return null
}

export function buildNavigationIntentContext(query: string): NavigationIntentContext {
  const queryRaw = query
  const queryNormalized = normalizeText(query)
  const tokens = tokenizeNormalized(queryNormalized)

  const queryCategoryRaw = detectCategory(queryNormalized)
  const queryCategory: DocCategory | null = queryCategoryRaw === 'UNKNOWN' ? null : queryCategoryRaw

  const accessoryTerms: string[] = []
  for (const term of ACCESSORY_TERMS) {
    const tn = normalizeText(term)
    if (tn && queryNormalized.includes(tn)) accessoryTerms.push(tn)
  }

  const numbers = extractNumbers(tokens)
  const modelOrMeasureTerms = extractModelOrMeasureTerms(queryNormalized, tokens)

  const catToken = categoryTokenFor(queryCategory)
  const attributes = tokens.filter((t) => {
    if (!t) return false
    if (STOPWORDS.has(t)) return false
    if (catToken && t === catToken) return false
    if (ACCESSORY_TERMS.has(t)) return false
    if (/^\d+(?:[.,]\d+)?$/u.test(t)) return false
    if (modelOrMeasureTerms.includes(t)) return false
    return true
  })

  return {
    queryRaw,
    queryNormalized,
    tokens,
    numbers,
    attributes,
    accessoryTerms,
    queryCategory,
    modelOrMeasureTerms,
  }
}

export function isNavigationIntent(ctx: NavigationIntentContext): boolean {
  if (!ctx.queryCategory) return false
  if (ctx.tokens.length > 2) return false
  if (ctx.numbers.length !== 0) return false
  if (ctx.attributes.length !== 0) return false
  if (ctx.accessoryTerms.length !== 0) return false

  // Regra final: bloquear qualquer indício de modelo/medidas
  if (ctx.modelOrMeasureTerms.length !== 0) return false

  return true
}

const CATEGORY_PATTERNS: Array<{ category: DocCategory; patterns: RegExp[] }> = [
  {
    category: 'VASSOURA',
    patterns: [
      /\bvassoura\b/u,
      /\bvassourao\b/u,
      /\bvassourao\b/u, // pós-normalização: vassourão -> vassourao
      /\bpiacava\b/u, // piaçava
      /\bpiassava\b/u, // variação comum
    ],
  },
  {
    category: 'MOP',
    patterns: [
      /\bmop\b/u,
      /\besfregao\b/u, // esfregão
    ],
  },
]

function includesAnyTerm(normalized: string, terms: Set<string>): boolean {
  for (const t of terms) {
    const tn = normalizeText(t)
    if (tn && normalized.includes(tn)) return true
  }
  return false
}

/**
 * detectCategory
 * - Sempre normalizeText antes de detectar
 * - Prioriza termos fortes (ordem dos patterns acima)
 */
export function detectCategory(text: string): DocCategory {
  const normalized = normalizeText(text)
  if (!normalized) return 'UNKNOWN'

  for (const entry of CATEGORY_PATTERNS) {
    for (const re of entry.patterns) {
      if (re.test(normalized)) return entry.category
    }
  }

  return 'UNKNOWN'
}

/**
 * detectDocType
 * Regra conservadora (compatível com reranker atual):
 * - Se contém termo de acessório => ACESSORIO
 * - Senão, se contém categoria forte => EQUIPAMENTO
 * - Senão => INDEFINIDO
 */
export function detectDocType(text: string): DocType {
  const normalized = normalizeText(text)
  if (!normalized) return 'INDEFINIDO'

  if (includesAnyTerm(normalized, ACCESSORY_TERMS)) return 'ACESSORIO'

  const category = detectCategory(normalized)
  if (category !== 'UNKNOWN') return 'EQUIPAMENTO'

  return 'INDEFINIDO'
}

export function detectQueryIntent(query: string): { intent: QueryIntent; queryCategory: DocCategory; accessoryTerms: string[] } {
  const normalized = normalizeText(query)
  const tokens = tokenizeNormalized(normalized)

  const queryCategory = detectCategory(normalized)

  const accessoryTerms: string[] = []
  for (const term of ACCESSORY_TERMS) {
    const tn = normalizeText(term)
    if (tn && normalized.includes(tn)) accessoryTerms.push(tn)
  }

  const firstAccessoryIndex = (() => {
    for (let i = 0; i < tokens.length; i++) {
      if (ACCESSORY_TERMS.has(tokens[i])) return i
    }
    return -1
  })()

  // Approx category position: first occurrence of a strong category token
  const categoryToken = queryCategory === 'MOP' ? 'mop' : queryCategory === 'VASSOURA' ? 'vassoura' : null
  const categoryIndex = categoryToken ? tokens.indexOf(categoryToken) : -1

  let intent: QueryIntent = 'INDEFINIDO'

  if (queryCategory !== 'UNKNOWN' && firstAccessoryIndex !== -1) {
    intent = categoryIndex !== -1 && categoryIndex <= firstAccessoryIndex ? 'EQUIPAMENTO' : 'ACESSORIO'
  } else if (queryCategory !== 'UNKNOWN') {
    intent = 'EQUIPAMENTO'
  } else if (firstAccessoryIndex !== -1) {
    intent = 'ACESSORIO'
  }

  return { intent, queryCategory, accessoryTerms }
}
