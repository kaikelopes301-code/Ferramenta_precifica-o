/**
 * Search Engine Integration Tests
 *
 * Tests for the TypeScript search engine (Python proxy was removed)
 */

import { describe, it, expect } from 'vitest'
import { parseEngineMode } from '../src/domain/searchEngine.js'

describe('Search Engine Configuration', () => {
  describe('parseEngineMode', () => {
    it('should return ts for undefined input (default)', () => {
      expect(parseEngineMode(undefined)).toBe('ts')
    })

    it('should return ts for empty string', () => {
      expect(parseEngineMode('')).toBe('ts')
    })

    it('should return ts for "ts" input', () => {
      expect(parseEngineMode('ts')).toBe('ts')
    })

    it('should return ts for "typescript" input', () => {
      expect(parseEngineMode('typescript')).toBe('ts')
    })

    it('should return python for "python" input', () => {
      expect(parseEngineMode('python')).toBe('python')
    })

    it('should return dual for "dual" input', () => {
      expect(parseEngineMode('dual')).toBe('dual')
    })

    it('should return ts for unknown values (default fallback)', () => {
      expect(parseEngineMode('unknown')).toBe('ts')
      expect(parseEngineMode('invalid')).toBe('ts')
    })
  })
})
