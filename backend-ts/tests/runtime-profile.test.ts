/**
 * Runtime Profile Configuration Tests
 * 
 * Tests environment configuration and runtime profiles
 */
import { describe, it, expect } from 'vitest'
import { config } from '../src/config/env.js'

describe('Runtime Profile Configuration', () => {
  it('should load configuration successfully', () => {
    expect(config).toBeDefined()
    expect(config.runtimeProfile).toBeDefined()
    expect(['default', 'free_tier']).toContain(config.runtimeProfile)
  })

  it('should have valid maxTopK setting', () => {
    expect(config.maxTopK).toBeGreaterThan(0)
    expect(config.maxTopK).toBeLessThanOrEqual(100)
  })

  it('should have valid maxBatchSize setting', () => {
    expect(config.maxBatchSize).toBeGreaterThan(0)
    expect(config.maxBatchSize).toBeLessThanOrEqual(100)
  })

  it('should have valid port configuration', () => {
    expect(config.port).toBeGreaterThan(0)
    expect(config.port).toBeLessThan(65536)
  })

  it('should have valid search engine mode', () => {
    expect(['ts', 'python', 'dual']).toContain(config.searchEngineMode)
  })

  it('should have valid embeddings provider mode', () => {
    expect(['mock', 'openai', 'hf', 'none']).toContain(config.embeddingsProviderMode)
  })

  it('should have valid cross-encoder provider mode', () => {
    expect(['mock', 'hf', 'none']).toContain(config.crossEncoderProviderMode)
  })

  it('should respect free_tier constraints when configured', () => {
    if (config.runtimeProfile === 'free_tier') {
      // Free tier should have conservative limits
      expect(config.maxTopK).toBeLessThanOrEqual(30)
      expect(config.maxBatchSize).toBeLessThanOrEqual(20)
    }
  })
})
