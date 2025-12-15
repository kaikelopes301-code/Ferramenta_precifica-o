// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este módulo faz parte do núcleo da engine de busca TypeScript.
// Responsável por: normalização de texto para busca (remoção de acentos, lowercase, unificação de unidades).
// Usado por: tsHybridEngine, semanticReranker, domainClassification, attributes.

/**
 * Normalization Module
 *
 * Faithfully reproduces the Python normalization logic from:
 * backend/app/processamento/normalize.py
 *
 * This module is the TypeScript source of truth for text normalization,
 * validated against Python via golden tests.
 *
 * @see tests/fixtures/normalization_golden.json
 */

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Load JSON mappings
const abbrevMap = require('./mappings/abbrev_map.json') as Record<string, string>
const domainSynonyms = require('./mappings/domain_synonyms.json') as Record<string, string>

// Type assertions for imported JSON
const ABBREV_MAP: Record<string, string> = abbrevMap
const DOMAIN_SYNONYMS: Record<string, string> = domainSynonyms

// Unit equivalence mapping (mirrors Python UNIT_EQUIV)
export const UNIT_EQUIV: Record<string, string> = {
  cv: 'hp', // converte cv em hp para padronizar
  hp: 'hp',
  kva: 'kva',
  kw: 'kw',
  v: 'v',
  volts: 'v',
  hz: 'hz',
}

// Regex patterns for equipment normalization
const NUM_UNIT_PATTERN = /(\d+[.,]?\d*)\s*(kva|kw|hp|cv|v|hz)\b/gi
const PARENS_PATTERN = /[()[\]{}]/g
const NON_ALNUM_SPACE = /[^a-z0-9\s]/g
const MULTI_SPACE = /\s+/g

/**
 * Remove accents from text using Unicode normalization.
 * Mirrors Python's strip_accents function.
 */
export function stripAccents(s: string): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Split and clean text into tokens.
 * Mirrors Python's _split_clean function.
 */
function splitClean(s: string): string[] {
  let text = s.toLowerCase()
  text = text.replace(NON_ALNUM_SPACE, ' ')
  text = text.replace(MULTI_SPACE, ' ').trim()
  return text.split(' ').filter((t) => t.length > 0)
}

/**
 * Simple Portuguese singularization heuristic.
 * Mirrors Python's _singularize_pt function.
 *
 * Handles regular plurals like: vassouras -> vassoura, mopos -> mopo
 * Does not cover special cases (mãos, flores, etc.)
 */
function singularizePt(token: string): string {
  const t = token
  if (t.length <= 3) return t

  // Common endings
  if (t.endsWith('es') && t.length > 4) {
    return t.slice(0, -2)
  }
  if (t.endsWith('s') && t.length > 3) {
    return t.slice(0, -1)
  }
  return t
}

/**
 * Aggressive normalization for equipment text search.
 * Mirrors Python's normalize_equip function.
 *
 * Transformations applied:
 * - lowercase + remove accents
 * - remove parentheses/superfluous punctuation
 * - collapse whitespace
 * - join number+unit (7 hp -> 7hp)
 * - convert cv->hp
 * - expand abbreviations (mot -> motor)
 * - standardize units
 */
export function normalizeEquip(text: string): string {
  if (!text) return ''

  let t = stripAccents(text.toLowerCase())
  t = t.replace(PARENS_PATTERN, ' ')
  t = t.replace(NON_ALNUM_SPACE, ' ')

  // Join number + unit
  t = t.replace(NUM_UNIT_PATTERN, (_match, num: string, unit: string) => {
    const normalizedNum = num.replace(',', '.')
    const normalizedUnit = UNIT_EQUIV[unit.toLowerCase()] ?? unit.toLowerCase()
    return `${normalizedNum}${normalizedUnit}`
  })

  t = t.replace(MULTI_SPACE, ' ').trim()

  const tokens: string[] = []
  for (const tok of t.split(' ')) {
    if (!tok) continue

    // Light singularization before mapping
    const base = tok in ABBREV_MAP ? tok : singularizePt(tok)

    // Mapping by abbreviation/word
    if (base in ABBREV_MAP) {
      const expanded = ABBREV_MAP[base]
      // Split expansion into clean tokens (removes commas, etc.)
      if (expanded) {
        tokens.push(...splitClean(expanded))
      }
    } else if (base in DOMAIN_SYNONYMS) {
      const expanded = DOMAIN_SYNONYMS[base]
      if (expanded) {
        tokens.push(...splitClean(expanded))
      }
    } else if (base in UNIT_EQUIV) {
      tokens.push(UNIT_EQUIV[base] ?? base)
    } else {
      tokens.push(base)
    }
  }

  return tokens.join(' ')
}

/**
 * Generate expansion variants for a query.
 * Mirrors Python's expansion_variants_for_query function.
 *
 * Returns phrases of variants when a token has expansion with multiple items.
 * Example: 'vassouras' -> ['vassoura nylon', 'vassoura piacava', ...]
 */
export function expansionVariantsForQuery(text: string): string[] {
  const s = stripAccents(text.toLowerCase())
  const toks = splitClean(s)
  const variants: string[] = []

  for (const t of toks) {
    const exp = ABBREV_MAP[t]
    if (exp && exp.includes(',')) {
      // Multiple variants separated by comma
      const parts = exp
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
      variants.push(...parts)
    }
  }

  // Remove duplicates preserving order
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of variants) {
    if (!seen.has(v)) {
      out.push(v)
      seen.add(v)
    }
  }

  return out
}

/**
 * Lightweight signature for fast duplicate pre-check.
 * Mirrors Python's consonant_signature function.
 *
 * Creates a compact signature combining consonants and numbers for quick comparison.
 * Format: "{consonants[:12]}_{numbers}"
 *
 * Example: "Motor Elétrico 220V 7.5HP" -> "mtrltrchp_2207.5"
 */
export function consonantSignature(text: string): string {
  const norm = normalizeEquip(text)
  const vowels = new Set(['a', 'e', 'i', 'o', 'u'])

  const consonants = [...norm]
    .filter((c) => /[a-zA-Z]/.test(c) && !vowels.has(c.toLowerCase()))
    .join('')

  const numbers = [...norm].filter((c) => /\d/.test(c)).join('')

  return consonants.slice(0, 12) + '_' + numbers
}

/**
 * Simple text normalization for general use.
 * Mirrors Python's normalize_text function.
 */
export function normalizeText(s: string): string {
  if (!s) return ''
  let text = s.toLowerCase().trim()
  text = text.replace(/[^a-z0-9\s.\-]/g, ' ')
  text = text.replace(MULTI_SPACE, ' ')
  return text
}

// Export mappings for use in other modules
export { ABBREV_MAP, DOMAIN_SYNONYMS }
