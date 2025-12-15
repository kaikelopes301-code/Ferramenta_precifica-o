/**
 * Domain Classification Unit Tests
 *
 * Tests the rule-based domain classifier for cleaning equipment.
 */

import { describe, it, expect } from 'vitest'
import {
  RuleBasedDomainClassifier,
  classifyQuery,
  classifyDocument,
  computeDomainScore,
  type DomainCategory,
  type DomainClassification,
} from '../src/domain/domainClassification.js'
import type { CorpusDocument } from '../src/domain/searchEngine.js'

describe('RuleBasedDomainClassifier', () => {
  const classifier = new RuleBasedDomainClassifier()

  describe('cleaning_core classification', () => {
    it('should classify lavadora de piso as cleaning_core', () => {
      const result = classifier.classifyText('lavadora de piso operação a pé 50L')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify aspirador as cleaning_core', () => {
      const result = classifier.classifyText('aspirador de água e pó industrial 1400W')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify hidrojateadora as cleaning_core', () => {
      const result = classifier.classifyText('hidrojateadora alta pressão 220V 2000PSI')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify enceradeira as cleaning_core', () => {
      const result = classifier.classifyText('enceradeira 200 RPM monodisco')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify extratora as cleaning_core', () => {
      const result = classifier.classifyText('extratora de carpetes 25L')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify varredeira as cleaning_core', () => {
      const result = classifier.classifyText('varredeira industrial autopropelida')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify auto-scrubber as cleaning_core', () => {
      const result = classifier.classifyText('auto-scrubber ride-on 120L')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('should classify lavadora with motor mention as cleaning_core (not peripheral)', () => {
      const result = classifier.classifyText('lavadora de piso 50L 220V motor 1,5HP')
      expect(result.category).toBe('cleaning_core')
      expect(result.confidence).toBeGreaterThan(0.9)
    })
  })

  describe('cleaning_support classification', () => {
    it('should classify refil mop as cleaning_support', () => {
      const result = classifier.classifyText('refil mop plano microfibra')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify balde espremedor as cleaning_support', () => {
      const result = classifier.classifyText('balde espremedor duplo 40L')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify carrinho funcional as cleaning_support', () => {
      const result = classifier.classifyText('carrinho funcional completo com sacos')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify disco para enceradeira as cleaning_support', () => {
      const result = classifier.classifyText('disco para enceradeira 17 polegadas')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify pad as cleaning_support', () => {
      const result = classifier.classifyText('pad para limpeza pesada verde')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify vassoura as cleaning_support', () => {
      const result = classifier.classifyText('vassoura profissional cabo longo')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify rodo as cleaning_support', () => {
      const result = classifier.classifyText('rodo plástico 60cm')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify espremedor as cleaning_support', () => {
      const result = classifier.classifyText('espremedor de mop giratório')
      expect(result.category).toBe('cleaning_support')
      expect(result.confidence).toBeGreaterThan(0.85)
    })
  })

  describe('peripheral classification', () => {
    it('should classify celular as peripheral', () => {
      const result = classifier.classifyText('celular android 64GB')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify smartphone as peripheral', () => {
      const result = classifier.classifyText('smartphone iPhone 12')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify notebook as peripheral', () => {
      const result = classifier.classifyText('notebook core i5 8GB RAM')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify computador as peripheral', () => {
      const result = classifier.classifyText('computador desktop completo')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify relógio de ponto as peripheral', () => {
      const result = classifier.classifyText('relógio de ponto biométrico')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify escada as peripheral', () => {
      const result = classifier.classifyText('escada alumínio 6 degraus')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.85)
    })

    it('should classify standalone motor as peripheral', () => {
      const result = classifier.classifyText('motor 5HP trifásico WEG')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should classify motor elétrico avulso as peripheral', () => {
      const result = classifier.classifyText('motor elétrico 3HP 220V monofásico')
      expect(result.category).toBe('peripheral')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
  })

  describe('unknown classification', () => {
    it('should classify empty text as unknown', () => {
      const result = classifier.classifyText('')
      expect(result.category).toBe('unknown')
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should classify ambiguous text as unknown', () => {
      const result = classifier.classifyText('produto genérico')
      expect(result.category).toBe('unknown')
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should classify unrecognizable text as unknown', () => {
      const result = classifier.classifyText('xyzabc123 teste')
      expect(result.category).toBe('unknown')
      expect(result.confidence).toBeLessThan(0.5)
    })
  })

  describe('edge cases', () => {
    it('should handle text with special characters', () => {
      const result = classifier.classifyText('lavadora de piso 50L (220V)')
      expect(result.category).toBe('cleaning_core')
    })

    it('should handle text with accents', () => {
      const result = classifier.classifyText('aspirador água e pó')
      expect(result.category).toBe('cleaning_core')
    })

    it('should be case insensitive', () => {
      const result1 = classifier.classifyText('LAVADORA DE PISO')
      const result2 = classifier.classifyText('lavadora de piso')
      expect(result1.category).toBe(result2.category)
    })

    it('should handle mixed content favoring cleaning keywords', () => {
      const result = classifier.classifyText('lavadora de piso com motor 2HP')
      expect(result.category).toBe('cleaning_core')
    })
  })
})

describe('classifyQuery', () => {
  it('should classify query text correctly', () => {
    const result = classifyQuery('lavadora de piso 50L')
    expect(result.category).toBe('cleaning_core')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('should normalize query before classifying', () => {
    const result = classifyQuery('LAVADORA DE PISO')
    expect(result.category).toBe('cleaning_core')
  })
})

describe('classifyDocument', () => {
  it('should classify document using text field', () => {
    const doc: CorpusDocument = {
      id: 'DOC_001',
      groupId: 'GROUP_001',
      text: 'lavadora de piso 50L 220V',
      rawText: 'Lavadora de Piso 50L 220V',
    }
    const result = classifyDocument(doc)
    expect(result.category).toBe('cleaning_core')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('should handle document without rawText', () => {
    const doc: CorpusDocument = {
      id: 'DOC_002',
      groupId: 'GROUP_002',
      text: 'balde espremedor duplo',
    }
    const result = classifyDocument(doc)
    expect(result.category).toBe('cleaning_support')
  })

  it('should fallback to rawText if text is empty', () => {
    const doc: CorpusDocument = {
      id: 'DOC_003',
      groupId: 'GROUP_003',
      text: '',
      rawText: 'aspirador industrial',
    }
    const result = classifyDocument(doc)
    expect(result.category).toBe('cleaning_core')
  })
})

describe('computeDomainScore', () => {
  describe('cleaning_core queries', () => {
    const queryDomain: DomainClassification = {
      category: 'cleaning_core',
      confidence: 0.95,
    }

    it('should give highest score for cleaning_core documents', () => {
      const docDomain: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeGreaterThan(0.9)
    })

    it('should give high score for cleaning_support documents', () => {
      const docDomain: DomainClassification = {
        category: 'cleaning_support',
        confidence: 0.90,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeGreaterThan(0.7)
      expect(score).toBeLessThan(0.9)
    })

    it('should give low score for peripheral documents', () => {
      const docDomain: DomainClassification = {
        category: 'peripheral',
        confidence: 0.90,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeLessThan(0.3)
    })

    it('should give medium score for unknown documents', () => {
      const docDomain: DomainClassification = {
        category: 'unknown',
        confidence: 0.30,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeGreaterThan(0.3)
      expect(score).toBeLessThan(0.7)
    })
  })

  describe('cleaning_support queries', () => {
    const queryDomain: DomainClassification = {
      category: 'cleaning_support',
      confidence: 0.90,
    }

    it('should give highest score for cleaning_support documents', () => {
      const docDomain: DomainClassification = {
        category: 'cleaning_support',
        confidence: 0.90,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeGreaterThan(0.85)
    })

    it('should give high score for cleaning_core documents', () => {
      const docDomain: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeGreaterThan(0.65)
      expect(score).toBeLessThan(0.85)
    })

    it('should give low score for peripheral documents', () => {
      const docDomain: DomainClassification = {
        category: 'peripheral',
        confidence: 0.90,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeLessThan(0.4)
    })
  })

  describe('peripheral queries', () => {
    const queryDomain: DomainClassification = {
      category: 'peripheral',
      confidence: 0.90,
    }

    it('should give highest score for peripheral documents', () => {
      const docDomain: DomainClassification = {
        category: 'peripheral',
        confidence: 0.90,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeGreaterThan(0.85)
    })

    it('should give low score for cleaning_core documents', () => {
      const docDomain: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }
      const score = computeDomainScore({ queryDomain, docDomain })
      expect(score).toBeLessThan(0.4)
    })
  })

  describe('unknown queries', () => {
    const queryDomain: DomainClassification = {
      category: 'unknown',
      confidence: 0.30,
    }

    it('should prefer cleaning equipment over peripheral', () => {
      const cleaningDoc: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }
      const peripheralDoc: DomainClassification = {
        category: 'peripheral',
        confidence: 0.90,
      }

      const cleaningScore = computeDomainScore({ queryDomain, docDomain: cleaningDoc })
      const peripheralScore = computeDomainScore({ queryDomain, docDomain: peripheralDoc })

      expect(cleaningScore).toBeGreaterThan(peripheralScore)
    })

    it('should give reasonable scores to all categories', () => {
      const categories: DomainCategory[] = ['cleaning_core', 'cleaning_support', 'peripheral', 'unknown']

      const scores = categories.map((cat) => {
        const docDomain: DomainClassification = { category: cat, confidence: 0.80 }
        return computeDomainScore({ queryDomain, docDomain })
      })

      // All scores should be in reasonable range
      scores.forEach((score) => {
        expect(score).toBeGreaterThan(0.2)
        expect(score).toBeLessThan(0.9)
      })
    })
  })

  describe('confidence modulation', () => {
    it('should produce higher score with higher confidence', () => {
      const queryHigh: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }
      const queryLow: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.50,
      }
      const doc: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }

      const scoreHigh = computeDomainScore({ queryDomain: queryHigh, docDomain: doc })
      const scoreLow = computeDomainScore({ queryDomain: queryLow, docDomain: doc })

      expect(scoreHigh).toBeGreaterThan(scoreLow)
    })

    it('should keep score in [0, 1] range', () => {
      const categories: DomainCategory[] = ['cleaning_core', 'cleaning_support', 'peripheral', 'unknown']

      for (const qCat of categories) {
        for (const dCat of categories) {
          const queryDomain: DomainClassification = { category: qCat, confidence: 0.95 }
          const docDomain: DomainClassification = { category: dCat, confidence: 0.95 }

          const score = computeDomainScore({ queryDomain, docDomain })

          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  describe('score monotonicity', () => {
    it('should maintain ordering: same > related > unrelated', () => {
      const queryDomain: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }

      const sameDoc: DomainClassification = {
        category: 'cleaning_core',
        confidence: 0.95,
      }
      const relatedDoc: DomainClassification = {
        category: 'cleaning_support',
        confidence: 0.90,
      }
      const unrelatedDoc: DomainClassification = {
        category: 'peripheral',
        confidence: 0.90,
      }

      const samScore = computeDomainScore({ queryDomain, docDomain: sameDoc })
      const relScore = computeDomainScore({ queryDomain, docDomain: relatedDoc })
      const unrelScore = computeDomainScore({ queryDomain, docDomain: unrelatedDoc })

      expect(samScore).toBeGreaterThan(relScore)
      expect(relScore).toBeGreaterThan(unrelScore)
    })
  })
})
