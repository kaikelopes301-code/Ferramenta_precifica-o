/**
 * Favorites Repository
 * 
 * Handles CRUD operations for user favorites.
 */

import { Repository } from 'typeorm';
import { AppDataSource, Favorite } from '../../infra/database/connection.js';
import { BaseRepository } from './BaseRepository.js';

export class FavoritesRepository implements BaseRepository<Favorite> {
    private repo: Repository<Favorite>;

    constructor() {
        this.repo = AppDataSource.getRepository(Favorite);
    }

    async findById(id: number): Promise<Favorite | null> {
        return await this.repo.findOneBy({ id });
    }

    async findAll(filters?: { user_id?: string }): Promise<Favorite[]> {
        const query = this.repo.createQueryBuilder('favorite');

        if (filters?.user_id) {
            query.where('favorite.user_id = :user_id', { user_id: filters.user_id });
        }

        query.orderBy('favorite.created_at', 'DESC');

        return await query.getMany();
    }

    async create(data: Partial<Favorite>): Promise<Favorite> {
        // Validate required fields
        if (!data.item_name || data.item_name.trim() === '') {
            throw new Error('item_name is required and cannot be empty');
        }
        
        const entity = this.repo.create(data);
        return await this.repo.save(entity);
    }

    async update(id: number, data: Partial<Favorite>): Promise<Favorite | null> {
        await this.repo.update(id, data);
        return await this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.repo.delete(id);
        return (result.affected ?? 0) > 0;
    }

    /**
     * Delete favorite only if it belongs to the user (security check)
     */
    async deleteByIdAndUser(id: number, user_id: string): Promise<boolean> {
        const result = await this.repo.delete({ id, user_id });
        return (result.affected ?? 0) > 0;
    }
}
