import { LRUCache } from 'lru-cache';
import { normalizeText } from '../../../utils/textNormalization.js';

interface CacheOptions {
    max: number;
    ttl: number; // in milliseconds
}

export class SearchCache<T> {
    private cache: LRUCache<string, T[]>;

    constructor(options: CacheOptions = { max: 1000, ttl: 1000 * 60 * 60 }) { // Default: 1000 items, 1 hour
        this.cache = new LRUCache<string, T[]>({
            max: options.max,
            ttl: options.ttl,
        });
    }

    /**
     * Generates a normalized cache key from the search query.
     */
    private normalizeKey(query: string): string {
        return normalizeText(query);
    }

    /**
     * Retrieves results from cache if available.
     */
    get(query: string): T[] | undefined {
        const key = this.normalizeKey(query);
        return this.cache.get(key);
    }

    /**
     * Stores results in cache.
     */
    set(query: string, results: T[]): void {
        const key = this.normalizeKey(query);
        this.cache.set(key, results);
    }

    /**
     * Clears the cache.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Returns cache stats (size).
     */
    get stats() {
        return {
            size: this.cache.size,
        };
    }
}
