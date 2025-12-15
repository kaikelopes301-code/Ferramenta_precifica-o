/**
 * Base Repository Interface
 * 
 * Generic repository pattern for CRUD operations.
 */

import type { RepositoryFilters } from '../../contracts/dto.types.js';

export interface BaseRepository<T> {
    findById(id: number): Promise<T | null>;
    findAll(filters?: RepositoryFilters<T>): Promise<T[]>;
    create(data: Partial<T>): Promise<T>;
    update(id: number, data: Partial<T>): Promise<T | null>;
    delete(id: number): Promise<boolean>;
}
