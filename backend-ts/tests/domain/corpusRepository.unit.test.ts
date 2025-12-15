/**
 * FileCorpusRepository Unit Tests
 *
 * Tests the file-based corpus repository implementation.
 */

import path from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { FileCorpusRepository } from '../../src/domain/corpus/FileCorpusRepository.js'

// Path to the test fixture
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/dataset_ts_sample.json')

describe('FileCorpusRepository', () => {
  let repository: FileCorpusRepository

  beforeEach(() => {
    // Create fresh instance for each test
    repository = new FileCorpusRepository(FIXTURE_PATH)
  })

  describe('getAllDocuments', () => {
    it('should load documents from fixture file', async () => {
      const docs = await repository.getAllDocuments()
      expect(docs).toBeInstanceOf(Array)
      expect(docs.length).toBeGreaterThan(0)
    })

    it('should return CorpusDocument objects with required fields', async () => {
      const docs = await repository.getAllDocuments()
      const doc = docs[0]

      expect(doc).toHaveProperty('id')
      expect(doc).toHaveProperty('groupId')
      expect(doc).toHaveProperty('text')
      expect(typeof doc.id).toBe('string')
      expect(typeof doc.groupId).toBe('string')
      expect(typeof doc.text).toBe('string')
    })

    it('should cache documents after first load', async () => {
      // First load
      const docs1 = await repository.getAllDocuments()

      // Second load should be same reference (cached)
      const docs2 = await repository.getAllDocuments()

      expect(docs1).toBe(docs2)
    })

    it('should load 20 documents from sample fixture', async () => {
      const docs = await repository.getAllDocuments()
      expect(docs.length).toBe(20)
    })
  })

  describe('getDocumentById', () => {
    it('should return document when ID exists', async () => {
      const doc = await repository.getDocumentById('DOC_00001')
      expect(doc).not.toBeNull()
      expect(doc?.id).toBe('DOC_00001')
    })

    it('should return null when ID does not exist', async () => {
      const doc = await repository.getDocumentById('NONEXISTENT_ID')
      expect(doc).toBeNull()
    })

    it('should return same document on multiple calls', async () => {
      const doc1 = await repository.getDocumentById('DOC_00001')
      const doc2 = await repository.getDocumentById('DOC_00001')
      expect(doc1).toBe(doc2)
    })
  })

  describe('getDocumentsByGroupId', () => {
    it('should return documents for existing groupId', async () => {
      // Use a groupId that exists in the fixture
      const allDocs = await repository.getAllDocuments()
      const firstGroupId = allDocs[0].groupId
      const docs = await repository.getDocumentsByGroupId(firstGroupId)
      expect(docs.length).toBeGreaterThan(0)
      expect(docs.every((d) => d.groupId === firstGroupId)).toBe(true)
    })

    it('should return empty array for non-existent groupId', async () => {
      const docs = await repository.getDocumentsByGroupId('NONEXISTENT_GROUP')
      expect(docs).toEqual([])
    })
  })

  describe('getSugestoes', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const allDocs = await repository.getAllDocuments()
      const firstGroupId = allDocs[0].groupId
      const sugestoes = await repository.getSugestoes(firstGroupId)
      expect(sugestoes).toEqual([])
    })
  })

  describe('getMetadata', () => {
    it('should return metadata from file', async () => {
      const metadata = await repository.getMetadata()
      expect(metadata).not.toBeNull()
      expect(metadata?.description).toBeDefined()
    })
  })

  describe('getDocumentCount', () => {
    it('should return correct count', async () => {
      const count = await repository.getDocumentCount()
      expect(count).toBe(20)
    })
  })

  describe('isLoaded', () => {
    it('should return false before loading', () => {
      expect(repository.isLoaded()).toBe(false)
    })

    it('should return true after loading', async () => {
      await repository.getAllDocuments()
      expect(repository.isLoaded()).toBe(true)
    })
  })

  describe('reset', () => {
    it('should clear cached data', async () => {
      await repository.getAllDocuments()
      expect(repository.isLoaded()).toBe(true)

      repository.reset()
      expect(repository.isLoaded()).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw on non-existent file', async () => {
      const badRepo = new FileCorpusRepository('/nonexistent/path/dataset.json')
      await expect(badRepo.getAllDocuments()).rejects.toThrow()
    })
  })

  describe('document content', () => {
    it('should have lavadoras in corpus', async () => {
      const docs = await repository.getAllDocuments()
      const lavadoras = docs.filter((d) =>
        d.text.toLowerCase().includes('lavadora')
      )
      expect(lavadoras.length).toBeGreaterThan(0)
    })

    it('should have aspiradores in corpus', async () => {
      const docs = await repository.getAllDocuments()
      const aspiradores = docs.filter((d) =>
        d.text.toLowerCase().includes('aspirador')
      )
      expect(aspiradores.length).toBeGreaterThan(0)
    })

    it('should preserve rawText field', async () => {
      const docs = await repository.getAllDocuments()
      const withRawText = docs.filter((d) => d.rawText)
      expect(withRawText.length).toBeGreaterThan(0)
    })
  })
})
