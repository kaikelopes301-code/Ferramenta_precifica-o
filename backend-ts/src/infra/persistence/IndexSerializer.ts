/**
 * Index Serialization and Persistence
 * 
 * Handles saving/loading of search indexes to disk with:
 * - Version control
 * - Checksum validation
 * - Corruption detection
 * - Fallback strategies
 * 
 * @version 2.0.0
 */

import fs from 'fs/promises';
import crypto from 'crypto';
import { BM25Index } from '../../domain/bm25.js';
import { FuzzyMatcher } from '../../domain/fuzzyMatcher.js';

const CURRENT_VERSION = '2.0.0';

export interface SerializedIndexData {
    bm25: ReturnType<BM25Index['toJSON']>;
    fuzzy: ReturnType<FuzzyMatcher['toJSON']>;
}

export interface SerializedIndex {
    version: string;
    timestamp: string;
    checksum: string;
    data: SerializedIndexData;
}

export class IndexSerializer {
    /**
     * Calculate SHA-256 checksum of serialized data
     */
    private static calculateChecksum(data: SerializedIndexData): string {
        const serialized = JSON.stringify(data);
        return crypto.createHash('sha256').update(serialized).digest('hex');
    }

    /**
     * Save indexes to disk with version and checksum
     */
    static async save(
        filepath: string,
        bm25Index: BM25Index,
        fuzzyMatcher: FuzzyMatcher
    ): Promise<void> {
        const data: SerializedIndexData = {
            bm25: bm25Index.toJSON(),
            fuzzy: fuzzyMatcher.toJSON(),
        };

        const checksum = this.calculateChecksum(data);

        const serialized: SerializedIndex = {
            version: CURRENT_VERSION,
            timestamp: new Date().toISOString(),
            checksum,
            data,
        };

        await fs.writeFile(filepath, JSON.stringify(serialized), 'utf-8');
        console.log(`[IndexSerializer] ✅ Saved index v${CURRENT_VERSION} with checksum ${checksum.substring(0, 8)}...`);
    }

    /**
     * Load indexes from disk with validation
     * 
     * Validates:
     * - File exists and is readable
     * - JSON is well-formed
     * - Version is compatible
     * - Checksum matches (data integrity)
     * 
     * Returns null if any validation fails (triggers rebuild)
     */
    static async load(filepath: string): Promise<{ bm25Index: BM25Index; fuzzyMatcher: FuzzyMatcher } | null> {
        try {
            // Read file
            const content = await fs.readFile(filepath, 'utf-8');
            
            // Parse JSON
            let parsed: unknown;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.error(`[IndexSerializer] ❌ Malformed JSON in ${filepath}:`, parseError);
                return null;
            }

            // Validate structure
            if (!this.isValidSerializedIndex(parsed)) {
                console.warn(`[IndexSerializer] ⚠️  Legacy index format detected in ${filepath}. Auto-migrating to v${CURRENT_VERSION}...`);
                return null;
            }

            const data = parsed as SerializedIndex;

            // Validate version
            if (data.version !== CURRENT_VERSION) {
                console.warn(`[IndexSerializer] ⚠️  Version mismatch: found ${data.version}, expected ${CURRENT_VERSION}. Rebuilding index...`);
                return null;
            }

            // Validate checksum
            const calculatedChecksum = this.calculateChecksum(data.data);
            if (calculatedChecksum !== data.checksum) {
                console.error(`[IndexSerializer] ❌ CHECKSUM MISMATCH! Index file is corrupted.`);
                console.error(`  Expected: ${data.checksum}`);
                console.error(`  Got:      ${calculatedChecksum}`);
                console.error(`  File will be rebuilt from source.`);
                return null;
            }

            // Reconstruct indexes
            const bm25Index = BM25Index.fromJSON(data.data.bm25);
            const fuzzyMatcher = FuzzyMatcher.fromJSON(data.data.fuzzy);

            console.log(`[IndexSerializer] ✅ Loaded index v${data.version} (checksum: ${data.checksum.substring(0, 8)}...)`);
            return { bm25Index, fuzzyMatcher };

        } catch (error) {
            // File doesn't exist or other FS error
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                console.info(`[IndexSerializer] ℹ️  Index file not found at ${filepath}. Will build fresh.`);
            } else {
                console.error(`[IndexSerializer] ❌ Failed to load index from ${filepath}:`, error);
            }
            return null;
        }
    }

    /**
     * Type guard for SerializedIndex structure
     */
    private static isValidSerializedIndex(obj: unknown): obj is SerializedIndex {
        if (typeof obj !== 'object' || obj === null) {
            return false;
        }

        const candidate = obj as Record<string, unknown>;

        return (
            typeof candidate.version === 'string' &&
            typeof candidate.timestamp === 'string' &&
            typeof candidate.checksum === 'string' &&
            typeof candidate.data === 'object' &&
            candidate.data !== null
        );
    }
}
