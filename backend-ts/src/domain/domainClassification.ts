// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este módulo faz parte do núcleo da engine de busca TypeScript.
// Responsável por: classificação de domínio (cleaning_core, cleaning_support, peripheral, unknown) para boost de relevância.
// Usado por: tsHybridEngine, FileCorpusRepository.

/**
 * Domain Classification for Cleaning Equipment
 *
 * This module classifies equipment descriptions into domain categories:
 * - cleaning_core: main cleaning machines (lavadoras, aspiradores, etc.)
 * - cleaning_support: items used in cleaning workflows (mops, buckets, pads, etc.)
 * - peripheral: non-cleaning items (electronics, generic motors, etc.)
 * - unknown: cannot be safely mapped
 *
 * Uses rule-based classification with keyword matching on normalized text.
 */

import { normalizeEquip } from './normalization.js'
import type { CorpusDocument } from './searchEngine.js'
import { logger } from '../infra/logging.js'

// =============================================================================
// Types
// =============================================================================

export type DomainCategory =
  | 'cleaning_core'
  | 'cleaning_support'
  | 'peripheral'
  | 'unknown'

export interface DomainClassification {
  category: DomainCategory
  confidence: number // 0.0 to 1.0
}

export interface DomainClassifier {
  classifyText(text: string): DomainClassification
}

// =============================================================================
// Keyword Sets (normalized, lowercase, no accents)
// =============================================================================

/**
 * Keywords for cleaning_core: main machines
 */
const CLEANING_CORE_KEYWORDS = [
  // Floor scrubbers / lavadoras de piso
  'lavadora de piso',
  'lavadora piso',
  'auto lavadora',
  'autolavadora',
  'auto-lavadora',
  'scrubber',
  'auto-scrubber',
  'autoscrubber',
  'lavadora de pisos',
  'maquina lavar piso',
  
  // Vacuum cleaners / aspiradores
  'aspirador',
  'aspiradora',
  'aspiradores',
  'aspira po',
  'aspira agua',
  'aspirador agua e po',
  'aspirador industrial',
  'aspirador de po',
  'vacuum',
  
  // Extractors / extratoras
  'extratora',
  'extrator',
  'extratoras',
  'carpet extractor',
  'extratora de carpete',
  
  // High-pressure washers / hidrojatos
  'hidrojato',
  'hidrojateadora',
  'hidro jato',
  'lavadora alta pressao',
  'lavadora de alta pressao',
  'lavadora pressao',
  'pressure washer',
  
  // Polishers / enceradeiras
  'enceradeira',
  'enceradeiras',
  'politriz',
  'polisher',
  'single disc',
  'single-disc',
  'monodisco',
  'mono disco',
  'disco unico',
  
  // Sweepers / varredeiras
  'varredeira',
  'varredeiras',
  'vassoura mecanica',
  'sweeper',
]

/**
 * Keywords for cleaning_support: items used in cleaning workflows
 */
const CLEANING_SUPPORT_KEYWORDS = [
  // Mops
  'mop',
  'refil mop',
  'cabo mop',
  'mop plano',
  'mop po',
  'esfregao',
  'esfregona',
  
  // Buckets / baldes
  'balde',
  'baldes',
  'balde espremedor',
  'espremedor',
  'balde duplo',
  'bucket',
  
  // Carts / carrinhos
  'carrinho funcional',
  'carrinho limpeza',
  'carrinho de limpeza',
  'carro funcional',
  'trolley',
  'cart',
  
  // Pads and discs for floor machines
  'disco para',
  'pad para',
  'disco enceradeira',
  'pad enceradeira',
  'disco limpeza',
  'fibra abrasiva',
  'lixa para piso',
  'disco de',
  'pad de',
  
  // Squeegees, brooms, small tools
  'vassoura',
  'rodo',
  'rodinho',
  'pa de lixo',
  'pa coletora',
  'pano',
  'flanela',
  'squeegee',
  'broom',
  
  // Wringers and accessories
  'espremedor de mop',
  'prensa',
  'suporte',
  'placa',
]

/**
 * Keywords for peripheral: non-cleaning items
 */
const PERIPHERAL_KEYWORDS = [
  // Electronics
  'celular',
  'smartphone',
  'telefone',
  'iphone',
  'android',
  
  // Computers
  'notebook',
  'laptop',
  'computador',
  'desktop',
  'pc',
  'tablet',
  
  // Office equipment
  'relogio de ponto',
  'radio',
  'walkie talkie',
  'walkie-talkie',
  
  // Generic tools and items
  'escada',
  'ladder',
]

/**
 * Patterns that suggest a standalone motor (peripheral)
 * These should be checked when "motor" appears in text
 */
const STANDALONE_MOTOR_PATTERNS = [
  /motor\s+\d+\s*hp/i,
  /motor\s+\d+\s*cv/i,
  /motor\s+trifasico/i,
  /motor\s+monofasico/i,
  /motor\s+eletrico/i,
  /motor\s+weg/i,
  /^\s*motor\s+/i, // Starts with "motor"
]

// =============================================================================
// Implementation
// =============================================================================

/**
 * Rule-based Domain Classifier
 *
 * Uses keyword matching on normalized text to determine domain category.
 * Considers "motor" mentions with special logic to distinguish between
 * standalone motors (peripheral) and motors as part of cleaning machines.
 */
export class RuleBasedDomainClassifier implements DomainClassifier {
  /**
   * Classify a text description into a domain category
   */
  classifyText(text: string): DomainClassification {
    if (!text || text.trim().length === 0) {
      return { category: 'unknown', confidence: 0.1 }
    }

    // Normalize the text
    const normalized = normalizeEquip(text).toLowerCase()

    // Check for cleaning_support keywords FIRST (more specific phrases like "disco para")
    const supportMatch = this.matchKeywords(normalized, CLEANING_SUPPORT_KEYWORDS)
    if (supportMatch.matched) {
      return { category: 'cleaning_support', confidence: 0.90 }
    }

    // Check for cleaning_core keywords (main machines)
    const coreMatch = this.matchKeywords(normalized, CLEANING_CORE_KEYWORDS)
    if (coreMatch.matched) {
      // If it's a cleaning machine, even with "motor" mentioned, it's still cleaning_core
      return { category: 'cleaning_core', confidence: 0.95 }
    }

    // Check for peripheral keywords
    const peripheralMatch = this.matchKeywords(normalized, PERIPHERAL_KEYWORDS)
    if (peripheralMatch.matched) {
      return { category: 'peripheral', confidence: 0.90 }
    }

    // Special handling for standalone motors
    // If "motor" appears and matches standalone patterns, classify as peripheral
    if (normalized.includes('motor')) {
      for (const pattern of STANDALONE_MOTOR_PATTERNS) {
        if (pattern.test(text)) {
          return { category: 'peripheral', confidence: 0.85 }
        }
      }
    }

    // No clear match, return unknown
    return { category: 'unknown', confidence: 0.3 }
  }

  /**
   * Check if normalized text matches any keyword from the set
   * Returns { matched: boolean, matchedKeywords: string[] }
   */
  private matchKeywords(
    normalized: string,
    keywords: string[]
  ): { matched: boolean; matchedKeywords: string[] } {
    const matched: string[] = []

    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        matched.push(keyword)
      }
    }

    return {
      matched: matched.length > 0,
      matchedKeywords: matched,
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Classify a corpus document
 */
export function classifyDocument(doc: CorpusDocument): DomainClassification {
  const classifier = new RuleBasedDomainClassifier()
  // Use the normalized text if available, otherwise the raw text
  const text = doc.text || doc.rawText || ''
  return classifier.classifyText(text)
}

/**
 * Classify a query string
 */
export function classifyQuery(query: string): DomainClassification {
  const classifier = new RuleBasedDomainClassifier()
  return classifier.classifyText(query)
}

// =============================================================================
// Domain Scoring
// =============================================================================

export interface DomainScoreInput {
  queryDomain: DomainClassification
  docDomain: DomainClassification
}

/**
 * Compute domain compatibility score between query and document
 *
 * Returns a score in [0, 1] based on:
 * - Base compatibility matrix between query and document categories
 * - Modulated by both query and document confidence
 *
 * Strategy:
 * - When query is cleaning_core, strongly prefer cleaning_core docs
 * - When query is cleaning_support, prefer support docs but also accept core
 * - When query is peripheral, allow peripheral docs to rank high
 * - When query is unknown, give cleaning equipment a boost (domain prior)
 */
export function computeDomainScore(input: DomainScoreInput): number {
  const { queryDomain, docDomain } = input

  // Base compatibility matrix: baseScore[queryCategory][docCategory]
  const baseScoreMatrix: Record<DomainCategory, Record<DomainCategory, number>> = {
    cleaning_core: {
      cleaning_core: 1.0,
      cleaning_support: 0.85,
      unknown: 0.6,
      peripheral: 0.2,
    },
    cleaning_support: {
      cleaning_support: 1.0,
      cleaning_core: 0.8,
      unknown: 0.6,
      peripheral: 0.3,
    },
    peripheral: {
      peripheral: 1.0,
      unknown: 0.7,
      cleaning_support: 0.4,
      cleaning_core: 0.3,
    },
    unknown: {
      cleaning_core: 0.8,
      cleaning_support: 0.75,
      unknown: 0.6,
      peripheral: 0.4,
    },
  }

  // Get base score from matrix
  const baseScore = baseScoreMatrix[queryDomain.category][docDomain.category]

  // Modulate by confidence: higher confidence → more weight on the base score
  // Use a blend: 50% guaranteed + 50% weighted by confidence product
  const confidenceProduct = queryDomain.confidence * docDomain.confidence
  const finalScore = baseScore * (0.5 + 0.5 * confidenceProduct)

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, finalScore))
}

// =============================================================================
// Singleton factory
// =============================================================================

let _domainClassifierInstance: DomainClassifier | null = null

/**
 * Get the global domain classifier instance
 */
export function getDomainClassifier(): DomainClassifier {
  if (!_domainClassifierInstance) {
    _domainClassifierInstance = new RuleBasedDomainClassifier()
    logger.info('[DomainClassifier] Initialized rule-based classifier')
  }
  return _domainClassifierInstance
}

/**
 * Reset the domain classifier instance (for testing)
 */
export function resetDomainClassifier(): void {
  _domainClassifierInstance = null
}
