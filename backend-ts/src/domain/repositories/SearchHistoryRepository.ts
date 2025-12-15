/**
 * Search History Repository
 * 
 * Handles CRUD operations for search history.
 */

import { Repository } from 'typeorm';
import { AppDataSource, SearchHistory } from '../../infra/database/connection.js';
import { BaseRepository } from './BaseRepository.js';

export class SearchHistoryRepository implements BaseRepository<SearchHistory> {
    private repo: Repository<SearchHistory>;

    constructor() {
        this.repo = AppDataSource.getRepository(SearchHistory);
    }

    async findById(id: number): Promise<SearchHistory | null> {
        return await this.repo.findOneBy({ id });
    }

    async findAll(filters?: { user_id?: string; limit?: number }): Promise<SearchHistory[]> {
        const query = this.repo.createQueryBuilder('history');

        if (filters?.user_id) {
            query.where('history.user_id = :user_id', { user_id: filters.user_id });
        }

        // Order by created_at descending (most recent first)
        query.orderBy('history.created_at', 'DESC');

        if (filters?.limit) {
            query.take(Math.min(filters.limit, 100));
        } else {
            query.take(20);
        }

        return await query.getMany();
    }

    async create(data: Partial<SearchHistory>): Promise<SearchHistory> {
        const entity = this.repo.create(data);
        return await this.repo.save(entity);
    }

    async update(id: number, data: Partial<SearchHistory>): Promise<SearchHistory | null> {
        await this.repo.update(id, data);
        return await this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.repo.delete(id);
        return (result.affected ?? 0) > 0;
    }

    /**
     * Log a search query
     */
    async logSearch(user_id: string, query: string, results_count: number, context_tags?: string): Promise<void> {
        await this.create({
            user_id,
            query,
            results_count,
            context_tags: context_tags || null,
        });
    }
}
