// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este módulo faz parte do núcleo da engine de busca TypeScript.
// Responsável por: extração de atributos numéricos (voltagem, capacidade, RPM, etc) para boost de relevância.
// Usado por: semanticReranker (numeric boost), tsHybridEngine.

/**
 * Attributes Extraction Module
 *
 * Faithfully reproduces the Python attribute extraction logic from:
 * backend/app/processamento/attributes.py
 *
 * This module extracts numeric and categorical attributes from equipment text.
 *
 * @see tests/fixtures/normalization_golden.json
 */

import { normalizeText } from './normalization.js'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Simple attributes extracted by extract_attributes (normalize.py)
 */
export interface SimpleAttributes {
  voltagem?: string
  tamanho_m?: number
}

/**
 * Full attributes extracted by extract_all_attributes (attributes.py)
 */
export interface FullAttributes {
  capacity_l?: number
  pressure_bar?: number
  diameter_mm?: number
  voltage_v?: number | 'bivolt'
  rpm?: number
  power_source?: 'battery' | 'electric' | 'lpg'
}

// =============================================================================
// REGEX PATTERNS (mirrors Python patterns)
// =============================================================================

const NUM = '(\\d+[.,]?\\d*)'

const PAT_LITER = new RegExp(`${NUM}\\s*(l|litros?|liter|liters?)\\b`, 'i')
const PAT_GAL = new RegExp(`${NUM}\\s*(gal|gallon|gallons)\\b`, 'i')
const PAT_PSI = new RegExp(`${NUM}\\s*(psi)\\b`, 'i')
const PAT_BAR = new RegExp(`${NUM}\\s*(bar)\\b`, 'i')
const PAT_IN = new RegExp(`${NUM}\\s*(in|inch|inches|")\\b`, 'i')
const PAT_MM = new RegExp(`${NUM}\\s*(mm)\\b`, 'i')
const PAT_V = /\b(110|127|220|230|240|12|24)\s*v\b|\bbivolt\b/i
const PAT_RPM = new RegExp(`${NUM}\\s*(rpm)\\b`, 'i')

// From normalize.py
const VOLTAGE_REGEX = /(\b110\b|\b127\b|\b220\b|\bbivolt\b|bivolt)/i
const SIZE_REGEX = /(\d+[.,]?\d*)\s*(mm|cm|m)/i

// Power sources keywords
const POWER_SOURCES: Record<string, Set<string>> = {
  battery: new Set([
    'battery',
    'bateria',
    'baterias',
    'lithium',
    'li-ion',
    'chumbo',
    'acido',
    'ácido',
  ]),
  electric: new Set(['eletric', 'eletrico', 'elétrico', 'cord', 'corded', 'tomada']),
  lpg: new Set(['lpg', 'glp', 'gas', 'gás']),
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert string to float, handling comma as decimal separator.
 */
function toFloat(s: string): number | null {
  try {
    const normalized = s.replace(',', '.')
    const value = parseFloat(normalized)
    return isNaN(value) ? null : value
  } catch {
    return null
  }
}

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract all attributes from equipment text.
 * Mirrors Python's extract_all_attributes function from attributes.py
 */
export function extractAllAttributes(text: string): FullAttributes {
  const s = text || ''
  const out: FullAttributes = {}

  // Capacity: liters / gallons
  let match = PAT_LITER.exec(s)
  if (match) {
    const val = toFloat(match[1] ?? '')
    if (val !== null) {
      out.capacity_l = val
    }
  } else {
    match = PAT_GAL.exec(s)
    if (match) {
      const gal = toFloat(match[1] ?? '')
      if (gal !== null) {
        out.capacity_l = gal * 3.78541
      }
    }
  }

  // Pressure: psi / bar
  match = PAT_PSI.exec(s)
  if (match) {
    const psi = toFloat(match[1] ?? '')
    if (psi !== null) {
      out.pressure_bar = psi * 0.0689476
    }
  } else {
    match = PAT_BAR.exec(s)
    if (match) {
      const bar = toFloat(match[1] ?? '')
      if (bar !== null) {
        out.pressure_bar = bar
      }
    }
  }

  // Brush diameter: inches / mm
  match = PAT_IN.exec(s)
  if (match) {
    const inch = toFloat(match[1] ?? '')
    if (inch !== null) {
      out.diameter_mm = inch * 25.4
    }
  } else {
    match = PAT_MM.exec(s)
    if (match) {
      const mm = toFloat(match[1] ?? '')
      if (mm !== null) {
        out.diameter_mm = mm
      }
    }
  }

  // Voltage
  match = PAT_V.exec(s)
  if (match) {
    if (match[0]?.toLowerCase().includes('bivolt')) {
      out.voltage_v = 'bivolt'
    } else {
      const v = parseInt(match[1] ?? '', 10)
      if (!isNaN(v)) {
        out.voltage_v = v
      }
    }
  }

  // RPM
  match = PAT_RPM.exec(s)
  if (match) {
    const rpm = toFloat(match[1] ?? '')
    if (rpm !== null) {
      out.rpm = rpm
    }
  }

  // Power source
  const low = normalizeText(s)
  for (const [key, keywords] of Object.entries(POWER_SOURCES)) {
    for (const keyword of keywords) {
      if (low.includes(keyword)) {
        out.power_source = key as 'battery' | 'electric' | 'lpg'
        break
      }
    }
    if (out.power_source) break
  }

  return out
}

/**
 * Extract simple attributes from equipment description.
 * Mirrors Python's extract_attributes function from normalize.py
 */
export function extractAttributes(desc: string): SimpleAttributes {
  const descN = normalizeText(desc)
  const attrs: SimpleAttributes = {}

  // Voltage
  const vMatch = VOLTAGE_REGEX.exec(descN)
  if (vMatch) {
    const val = vMatch[1]
    attrs.voltagem = val?.toLowerCase().includes('bivolt') ? 'bivolt' : val
  }

  // Size (normalize to meters)
  const sMatch = SIZE_REGEX.exec(descN)
  if (sMatch) {
    const numStr = sMatch[1] ?? ''
    const unit = sMatch[2] ?? ''
    const num = parseFloat(numStr.replace(',', '.'))

    if (!isNaN(num)) {
      if (unit.toLowerCase() === 'mm') {
        attrs.tamanho_m = num / 1000
      } else if (unit.toLowerCase() === 'cm') {
        attrs.tamanho_m = num / 100
      } else {
        attrs.tamanho_m = num
      }
    }
  }

  return attrs
}

/**
 * Unified attribute extraction combining both simple and full attributes.
 * Convenience function for use in search pipeline.
 */
export interface ExtractedAttributes extends SimpleAttributes, FullAttributes {}

export function extractAttributesFromText(text: string): ExtractedAttributes {
  const simple = extractAttributes(text)
  const full = extractAllAttributes(text)

  return {
    ...simple,
    ...full,
  }
}
