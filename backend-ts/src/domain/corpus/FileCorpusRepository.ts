/**
 * File-based Corpus Repository
 *
 * Loads corpus data from a JSON file exported by Python's dump_dataset_for_ts.py.
 * Implements singleton/lazy loading pattern to ensure dataset is loaded once per process.
 *
 * JSON Schema:
 * {
 *   "metadata": { ... },
 *   "corpus": [
 *     { "id": "DOC_00001", "groupId": "...", "text": "...", "rawText": "..." },
 *     ...
 *   ]
 * }
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { logger } from '../../infra/logging.js'
import type { CorpusRepository, CorpusDocument } from '../searchEngine.js'
import type { SugeridoItem } from '../searchContracts.js'
import { classifyDocument } from '../domainClassification.js'

// =============================================================================
// Types for JSON parsing
// =============================================================================

interface DatasetMetadata {
  description?: string
  source?: string
  exportedAt?: string
  corpusHash?: string
  totalRows?: number
  uniqueDocuments?: number
  targetCols?: string[]
  groupCol?: string
}

interface NumericMetrics {
  display: number
  mean: number
  median: number
  min: number
  max: number
  n: number
  unit?: 'fraction' | 'percent'
}

interface RawCorpusDocument {
  id: string
  groupId: string
  equipmentId?: string
  title?: string
  text: string
  rawText?: string
  semanticText?: string
  embedding?: number[]
  brand?: string
  supplier?: string
  
  // LEGACY fields (v3.0)
  price?: number
  lifespanMonths?: number
  maintenancePercent?: number
  
  // AGGREGATED fields (v4.0)
  metrics?: {
    valorUnitario?: NumericMetrics
    vidaUtilMeses?: NumericMetrics
    manutencao?: NumericMetrics
  }
  sources?: {
    fornecedores: string[]
    bids: string[]
    marcas: string[]
    nLinhas: number
  }
}

interface DatasetFile {
  metadata: DatasetMetadata
  corpus: RawCorpusDocument[]
}

// =============================================================================
// FileCorpusRepository Implementation
// =============================================================================

/**
 * File-based corpus repository
 *
 * Loads documents from a JSON file and caches them in memory.
 * Thread-safe via lazy initialization pattern.
 */
export class FileCorpusRepository implements CorpusRepository {
  private docs: CorpusDocument[] | null = null
  private docsById: Map<string, CorpusDocument> | null = null
  private docsByGroupId: Map<string, CorpusDocument[]> | null = null
  private metadata: DatasetMetadata | null = null
  private loadPromise: Promise<void> | null = null
  private readonly datasetPath: string

  constructor(datasetPath: string) {
    this.datasetPath = datasetPath
  }

  /**
   * Load dataset from file if not already loaded
   * Uses lazy loading pattern - dataset is loaded once per process
   */
  private async loadIfNeeded(): Promise<void> {
    if (this.docs !== null) return
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = this.doLoad()
    return this.loadPromise
  }

  private async doLoad(): Promise<void> {
    const startTime = Date.now()
    logger.info(`[FileCorpusRepository] Loading dataset from ${this.datasetPath}`)

    try {
      // Resolve path
      const resolvedPath = path.isAbsolute(this.datasetPath)
        ? this.datasetPath
        : path.resolve(process.cwd(), this.datasetPath)

      // Check file exists
      try {
        await fs.access(resolvedPath)
      } catch {
        throw new Error(`Dataset file not found: ${resolvedPath}`)
      }

      // Read and parse
      const content = await fs.readFile(resolvedPath, 'utf-8')
      const json = JSON.parse(content) as DatasetFile

      // Validate structure
      if (!json.corpus || !Array.isArray(json.corpus)) {
        throw new Error('Invalid dataset format: missing "corpus" array')
      }

      // Map to CorpusDocument[] and classify each document
      this.docs = json.corpus.map((item) => {
        const doc: CorpusDocument = {
          id: item.id,
          groupId: item.groupId,
          equipmentId: item.equipmentId,
          title: item.title,
          text: item.text,
          rawText: item.rawText,
          semanticText: item.semanticText,
          brand: item.brand,
          supplier: item.supplier,
          
          // LEGACY fields (v3.0) - manter para compatibilidade
          price: item.price,
          lifespanMonths: item.lifespanMonths,
          maintenancePercent: item.maintenancePercent,
          
          // AGGREGATED fields (v4.0)
          metrics: item.metrics,
          sources: item.sources,
        }
        
        // Validate and assign embedding if present
        if (item.embedding !== undefined) {
          if (Array.isArray(item.embedding) && item.embedding.length > 0) {
            doc.embedding = item.embedding
          } else {
            logger.warn(`[FileCorpusRepository] Invalid embedding for document ${item.id}: not a valid array`)
          }
        }
        
        // Classify document domain using text content
        doc.domain = classifyDocument(doc)
        
        return doc
      })

      // Build lookup maps
      this.docsById = new Map()
      this.docsByGroupId = new Map()

      for (const doc of this.docs) {
        this.docsById.set(doc.id, doc)

        const existing = this.docsByGroupId.get(doc.groupId) ?? []
        existing.push(doc)
        this.docsByGroupId.set(doc.groupId, existing)
      }

      // Store metadata
      this.metadata = json.metadata

      const duration = Date.now() - startTime
      logger.info(`[FileCorpusRepository] Loaded ${this.docs.length} documents in ${duration}ms`, {
        corpusHash: this.metadata?.corpusHash?.slice(0, 16),
        uniqueDocuments: this.docs.length,
      })
    } catch (error) {
      this.loadPromise = null
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[FileCorpusRepository] Failed to load dataset: ${message}`)
      throw error
    }
  }

  // =============================================================================
  // CorpusRepository Interface
  // =============================================================================

  async getAllDocuments(): Promise<CorpusDocument[]> {
    await this.loadIfNeeded()
    return this.docs!
  }

  async getDocumentById(id: string): Promise<CorpusDocument | null> {
    await this.loadIfNeeded()
    return this.docsById!.get(id) ?? null
  }

  /**
   * Get documents by group ID
   */
  async getDocumentsByGroupId(groupId: string): Promise<CorpusDocument[]> {
    await this.loadIfNeeded()
    return this.docsByGroupId!.get(groupId) ?? []
  }

  /**
   * Get suggested items for a group
   * For now, returns empty array - suggestions can be implemented in a future phase
   */
  async getSugestoes(_grupo: string): Promise<SugeridoItem[]> {
    // Future: implement suggestions based on related items
    // For now, return empty array to maintain API compatibility
    return []
  }

  // =============================================================================
  // Additional Methods
  // =============================================================================

  /**
   * Get dataset metadata
   */
  async getMetadata(): Promise<DatasetMetadata | null> {
    await this.loadIfNeeded()
    return this.metadata
  }

  /**
   * Get corpus hash for cache invalidation
   */
  async getCorpusHash(): Promise<string | null> {
    await this.loadIfNeeded()
    return this.metadata?.corpusHash ?? null
  }

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    await this.loadIfNeeded()
    return this.docs?.length ?? 0
  }

  /**
   * Check if repository is loaded
   */
  isLoaded(): boolean {
    return this.docs !== null
  }

  /**
   * Reset repository (for testing)
   */
  reset(): void {
    this.docs = null
    this.docsById = null
    this.docsByGroupId = null
    this.metadata = null
    this.loadPromise = null
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a file-based corpus repository
 */
export function createFileCorpusRepository(datasetPath: string): FileCorpusRepository {
  return new FileCorpusRepository(datasetPath)
}
