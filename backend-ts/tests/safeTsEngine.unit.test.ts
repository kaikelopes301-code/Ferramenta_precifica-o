/**
 * SafeTsEngine Unit Tests
 *
 * Tests automatic Python fallback behavior in SafeTsEngine
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SafeTsEngine, TimeoutError } from '../src/domain/engines/safeTsEngine.js'
import type { SearchEngine, SearchParams, SearchResult } from '../src/domain/searchEngine.js'
import type { Logger } from '../src/domain/engines/safeTsEngine.js'

// =============================================================================
// Fake Engines for Testing
// =============================================================================

function createMockLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  }
}

function createMockResult(engineName: string): SearchResult {
  return {
    query_original: 'test query',
    query_normalizada: 'test query',
    consonant_key: 'tst qr',
    expansoes_detectadas: [],
    modelo_semantico: 'mock',
    modelo_reranker: 'mock',
    resultados: [
      {
        grupo: 'G123',
        descricao: `Result from ${engineName}`,
        score: 0.95,
        score_normalized: 0.95,
        sugeridos: [],
      },
    ],
    total: 1,
  }
}

class FakeTsEngine implements SearchEngine {
  readonly name = 'FakeTsEngine'
  private shouldFail = false
  private shouldTimeout = false
  private callCount = 0

  setShouldFail(value: boolean) {
    this.shouldFail = value
  }

  setShouldTimeout(value: boolean) {
    this.shouldTimeout = value
  }

  getCallCount() {
    return this.callCount
  }

  resetCallCount() {
    this.callCount = 0
  }

  async isReady(): Promise<boolean> {
    return true
  }

  async smartSearch(_params: SearchParams): Promise<SearchResult> {
    this.callCount++

    if (this.shouldFail) {
      throw new Error('FakeTsEngine: intentional error')
    }

    if (this.shouldTimeout) {
      // Simulate slow response that will trigger timeout
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    return createMockResult('FakeTsEngine')
  }

  async smartSearchBatch(params: import('../src/domain/searchEngine.js').BatchSearchParams): Promise<SearchResult[]> {
    this.callCount++

    if (this.shouldFail) {
      throw new Error('FakeTsEngine: intentional batch error')
    }

    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    return params.descricoes.map(() => createMockResult('FakeTsEngine'))
  }
}

class FakePythonEngine implements SearchEngine {
  readonly name = 'FakePythonEngine'
  private callCount = 0

  getCallCount() {
    return this.callCount
  }

  resetCallCount() {
    this.callCount = 0
  }

  async isReady(): Promise<boolean> {
    return true
  }

  async smartSearch(_params: SearchParams): Promise<SearchResult> {
    this.callCount++
    return createMockResult('FakePythonEngine')
  }

  async smartSearchBatch(params: import('../src/domain/searchEngine.js').BatchSearchParams): Promise<SearchResult[]> {
    this.callCount++
    return params.descricoes.map(() => createMockResult('FakePythonEngine'))
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('SafeTsEngine', () => {
  let fakeTsEngine: FakeTsEngine
  let fakePythonEngine: FakePythonEngine
  let mockLogger: Logger

  beforeEach(() => {
    fakeTsEngine = new FakeTsEngine()
    fakePythonEngine = new FakePythonEngine()
    mockLogger = createMockLogger()
  })

  describe('isReady', () => {
    it('should return true when both engines are ready', async () => {
      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      const ready = await safeTsEngine.isReady()
      expect(ready).toBe(true)
    })
  })

  describe('smartSearch - TS success', () => {
    it('should return TS result when TS engine succeeds', async () => {
      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      const result = await safeTsEngine.smartSearch({ descricao: 'test' })

      // Should call TS engine
      expect(fakeTsEngine.getCallCount()).toBe(1)
      // Should NOT call Python engine
      expect(fakePythonEngine.getCallCount()).toBe(0)
      // Result should be from TS
      expect(result.resultados[0]?.descricao).toContain('FakeTsEngine')
      // Metadata should indicate TS was used
      expect(result.debug?.engineMetadata?.engineUsed).toBe('ts')
      expect(result.debug?.engineMetadata?.fallbackUsed).toBe(false)
    })
  })

  describe('smartSearch - TS error with fallback enabled', () => {
    it('should fallback to Python when TS throws error', async () => {
      fakeTsEngine.setShouldFail(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      const result = await safeTsEngine.smartSearch({ descricao: 'test' })

      // Should call TS engine (failed)
      expect(fakeTsEngine.getCallCount()).toBe(1)
      // Should call Python engine (fallback)
      expect(fakePythonEngine.getCallCount()).toBe(1)
      // Result should be from Python
      expect(result.resultados[0]?.descricao).toContain('FakePythonEngine')
      // Metadata should indicate fallback was used
      expect(result.debug?.engineMetadata?.engineUsed).toBe('python')
      expect(result.debug?.engineMetadata?.fallbackUsed).toBe(true)
      expect(result.debug?.engineMetadata?.fallbackReason).toBe('error')
    })

    it('should increment fallback stats', async () => {
      fakeTsEngine.setShouldFail(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      await safeTsEngine.smartSearch({ descricao: 'test1' })
      await safeTsEngine.smartSearch({ descricao: 'test2' })

      const stats = safeTsEngine.getStats()
      expect(stats.fallbackCount).toBe(2)
      expect(stats.errorCount).toBe(2)
      expect(stats.timeoutCount).toBe(0)
    })
  })

  describe('smartSearch - TS error with fallback disabled', () => {
    it('should throw error when fallback is disabled', async () => {
      fakeTsEngine.setShouldFail(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: false,
      })

      await expect(safeTsEngine.smartSearch({ descricao: 'test' })).rejects.toThrow(
        'FakeTsEngine: intentional error'
      )

      // Should call TS engine (failed)
      expect(fakeTsEngine.getCallCount()).toBe(1)
      // Should NOT call Python engine
      expect(fakePythonEngine.getCallCount()).toBe(0)
    })
  })

  describe('smartSearch - TS timeout', () => {
    it('should fallback to Python when TS times out', async () => {
      fakeTsEngine.setShouldTimeout(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 100, // Short timeout
        enableFallback: true,
      })

      const result = await safeTsEngine.smartSearch({ descricao: 'test' })

      // Should call Python engine (fallback)
      expect(fakePythonEngine.getCallCount()).toBe(1)
      // Result should be from Python
      expect(result.resultados[0]?.descricao).toContain('FakePythonEngine')
      // Metadata should indicate timeout fallback
      expect(result.debug?.engineMetadata?.engineUsed).toBe('python')
      expect(result.debug?.engineMetadata?.fallbackUsed).toBe(true)
      expect(result.debug?.engineMetadata?.fallbackReason).toBe('timeout')
    })

    it('should increment timeout stats', async () => {
      fakeTsEngine.setShouldTimeout(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 100,
        enableFallback: true,
      })

      await safeTsEngine.smartSearch({ descricao: 'test' })

      const stats = safeTsEngine.getStats()
      expect(stats.fallbackCount).toBe(1)
      expect(stats.timeoutCount).toBe(1)
      expect(stats.errorCount).toBe(0)
    })
  })

  describe('smartSearchBatch', () => {
    it('should return TS results when TS engine succeeds', async () => {
      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      const results = await safeTsEngine.smartSearchBatch({
        descricoes: ['query1', 'query2'],
      })

      expect(results).toHaveLength(2)
      expect(results[0]?.debug?.engineMetadata?.engineUsed).toBe('ts')
      expect(results[0]?.debug?.engineMetadata?.fallbackUsed).toBe(false)
    })

    it('should fallback to Python when TS fails', async () => {
      fakeTsEngine.setShouldFail(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      const results = await safeTsEngine.smartSearchBatch({
        descricoes: ['query1', 'query2'],
      })

      expect(results).toHaveLength(2)
      expect(results[0]?.debug?.engineMetadata?.engineUsed).toBe('python')
      expect(results[0]?.debug?.engineMetadata?.fallbackUsed).toBe(true)
    })
  })

  describe('stats', () => {
    it('should track multiple fallbacks', async () => {
      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 100,
        enableFallback: true,
      })

      // Mix of success, error, and timeout
      await safeTsEngine.smartSearch({ descricao: 'success' })

      fakeTsEngine.setShouldFail(true)
      await safeTsEngine.smartSearch({ descricao: 'error' })

      fakeTsEngine.setShouldFail(false)
      fakeTsEngine.setShouldTimeout(true)
      await safeTsEngine.smartSearch({ descricao: 'timeout' })

      const stats = safeTsEngine.getStats()
      expect(stats.fallbackCount).toBe(2) // error + timeout
      expect(stats.errorCount).toBe(1)
      expect(stats.timeoutCount).toBe(1)
    })

    it('should reset stats', async () => {
      fakeTsEngine.setShouldFail(true)

      const safeTsEngine = new SafeTsEngine(fakeTsEngine, fakePythonEngine, mockLogger, {
        timeoutMs: 1000,
        enableFallback: true,
      })

      await safeTsEngine.smartSearch({ descricao: 'test' })
      expect(safeTsEngine.getStats().fallbackCount).toBe(1)

      safeTsEngine.resetStats()
      expect(safeTsEngine.getStats().fallbackCount).toBe(0)
    })
  })
})

describe('TimeoutError', () => {
  it('should be instanceof Error', () => {
    const error = new TimeoutError('test timeout')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toBe('test timeout')
  })
})
