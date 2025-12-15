/**
 * Corpus Repository Implementation
 * 
 * Loads and manages the equipment corpus data
 * 
 * @deprecated This implementation is being replaced by domain/corpus/FileCorpusRepository.ts
 * Consider migrating to the domain-layer implementation for better separation of concerns.
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from './logging.js';
import { CorpusDocument } from '../domain/searchEngine.js';

export interface CorpusRepository {
    getAllDocuments(): Promise<CorpusDocument[]>;
    getDocumentById(id: string): Promise<CorpusDocument | null>;
    getSugestoes(grupo: string): Promise<any[]>;
}

/**
 * File-based corpus repository
 */
export class FileCorpusRepository implements CorpusRepository {
    private documents: Map<string, CorpusDocument> = new Map();
    private isLoaded = false;
    private dataPath: string;

    constructor(dataPath?: string) {
        if (dataPath) {
            this.dataPath = dataPath;
            return;
        }

        const localPath = path.join(process.cwd(), 'data', 'dataset_ts.json');
        const rootPath = path.join(process.cwd(), '..', 'data', 'dataset_ts.json');
        this.dataPath = existsSync(rootPath) ? rootPath : localPath;
    }

    async initialize(): Promise<void> {
        if (this.isLoaded) return;

        try {
            logger.info(`[CorpusRepository] Loading data from ${this.dataPath}`);
            const startTime = Date.now();

            const fileContent = await fs.readFile(this.dataPath, 'utf-8');
            const rawData = JSON.parse(fileContent);

            // Handle multiple formats
            let corpusArray: any[];
            
            if (Array.isArray(rawData)) {
                // Format 1: Direct array OR Format 2: [{metadata, corpus}]
                if (rawData.length > 0 && rawData[0].metadata && Array.isArray(rawData[0].corpus)) {
                    logger.info(`[CorpusRepository] Detected wrapped format with metadata`);
                    corpusArray = rawData[0].corpus;
                } else {
                    logger.info(`[CorpusRepository] Detected legacy array format`);
                    corpusArray = rawData;
                }
            } else if (rawData.metadata && Array.isArray(rawData.corpus)) {
                // Format 3 (NEW v3.0): {metadata, corpus} - not wrapped in array
                logger.info(`[CorpusRepository] Detected v3.0 format (unwrapped)`);
                corpusArray = rawData.corpus;
            } else {
                throw new Error('Invalid data format: expected array or {metadata, corpus} object');
            }

            for (const item of corpusArray) {
                const metrics = item.metrics;
                const displayPriceFromMetrics = metrics?.valorUnitario?.display;
                const displayLifespanFromMetrics = metrics?.vidaUtilMeses?.display;
                const displayMaintenanceRaw = metrics?.manutencao?.display;
                const maintenanceUnit = metrics?.manutencao?.unit ?? 'fraction';
                const displayMaintenancePercentFromMetrics =
                    displayMaintenanceRaw == null
                        ? undefined
                        : (maintenanceUnit === 'fraction' ? displayMaintenanceRaw * 100 : displayMaintenanceRaw);

                const doc: CorpusDocument = {
                    id: item.id || item.groupId || item.grupo || String(Math.random()),
                    groupId: item.groupId || item.grupo || item.id,

                    // v4+ (aggregated): ids e título canônicos
                    equipmentId: item.equipmentId,
                    title: item.title,
                    
                    // Text fields (NEW: semanticText support from v3.0)
                    text: item.text || item.searchableText || item.groupDescription || item.descricao || '',
                    rawText: item.rawText || item.text || '',
                    semanticText: item.semanticText, // NEW in v3.0 - rich text for embeddings
                    
                    // Display fields (DEPRECATED: prefer rawText)
                    groupDescription: item.groupDescription || item.descricao || item.rawText || item.text || '',
                    
                    // Domain classification
                    domain: item.dominantDomain || item.domain,

                    // Persisted taxonomy (build-time)
                    docCategory: item.docCategory,
                    docType: item.docType,
                    
                    // Metadata fields
                    brand: item.brand || item.marca,
                    price: item.price ?? item.valor_unitario ?? displayPriceFromMetrics,
                    lifespanMonths: item.lifespanMonths ?? item.vida_util_meses ?? item.vidaUtilMeses ?? displayLifespanFromMetrics,
                    maintenancePercent:
                        item.maintenancePercent ??
                        item.manutencao ??
                        item.manutencao_percent ??
                        displayMaintenancePercentFromMetrics,
                    supplier: item.supplier || item.fornecedor,

                    // Aggregated fields (v4.0+)
                    metrics,
                    sources: item.sources,
                    
                    // Additional metadata
                    metadata: {
                        rawEquipment: item.rawEquipment || item.equipamentos || [],
                        ...item.metadata
                    },
                };

                this.documents.set(doc.id, doc);
            }

            const duration = Date.now() - startTime;
            logger.info(`[CorpusRepository] Loaded ${this.documents.size} documents in ${duration}ms`);
            this.isLoaded = true;
        } catch (error) {
            logger.error('[CorpusRepository] Failed to load data:', error);
            throw new Error(`Failed to load corpus data: ${error}`);
        }
    }

    async getAllDocuments(): Promise<CorpusDocument[]> {
        if (!this.isLoaded) {
            await this.initialize();
        }
        return Array.from(this.documents.values());
    }

    async getDocumentById(id: string): Promise<CorpusDocument | null> {
        if (!this.isLoaded) {
            await this.initialize();
        }
        return this.documents.get(id) || null;
    }

    async getSugestoes(): Promise<any[]> {
        return [];
    }

    getStats(): {
        loaded: boolean;
        documentCount: number;
        dataPath: string;
    } {
        return {
            loaded: this.isLoaded,
            documentCount: this.documents.size,
            dataPath: this.dataPath,
        };
    }
}

export function createCorpusRepository(dataPath?: string): FileCorpusRepository {
    return new FileCorpusRepository(dataPath);
}
