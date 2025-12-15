/**
 * Kit Repository
 * 
 * Handles CRUD operations for kit items.
 */

import { Repository } from 'typeorm';
import { AppDataSource, KitItem } from '../../infra/database/connection.js';
import { BaseRepository } from './BaseRepository.js';
import type { BudgetCalculationDTO, BudgetItemDTO, KitItemFilters } from '../../contracts/dto.types.js';

export class KitRepository implements BaseRepository<KitItem> {
    private repo: Repository<KitItem>;

    constructor() {
        this.repo = AppDataSource.getRepository(KitItem);
    }

    async findById(id: number): Promise<KitItem | null> {
        return await this.repo.findOneBy({ id });
    }

    async findAll(filters?: KitItemFilters): Promise<KitItem[]> {
        const query = this.repo.createQueryBuilder('kit');

        if (filters?.user_id) {
            query.where('kit.user_id = :user_id', { user_id: filters.user_id });
        }

        query.orderBy('kit.created_at', 'DESC');

        return await query.getMany();
    }

    async create(data: Partial<KitItem>): Promise<KitItem> {
        const entity = this.repo.create(data);
        return await this.repo.save(entity);
    }

    async update(id: number, data: Partial<KitItem>): Promise<KitItem | null> {
        await this.repo.update(id, data);
        return await this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.repo.delete(id);
        return (result.affected ?? 0) > 0;
    }

    /**
     * Delete kit item only if it belongs to the user (security check)
     */
    async deleteByIdAndUser(id: number, user_id: string): Promise<boolean> {
        const result = await this.repo.delete({ id, user_id });
        return (result.affected ?? 0) > 0;
    }

    /**
     * Calculate total budget for user's kit
     */
    async calculateBudget(user_id: string): Promise<BudgetCalculationDTO> {
        const items = await this.findAll({ user_id });

        let total = 0;
        const budgetItems: BudgetItemDTO[] = items.map(item => {
            const price = item.price || 0;
            const qty = item.qty || 1;
            const subtotal = price * qty;
            total += subtotal;

            return {
                item: item.item_name,
                price: Number(price.toFixed(2)),
                qty,
                subtotal: Number(subtotal.toFixed(2)),
            };
        });

        return {
            items: budgetItems,
            total: Number(total.toFixed(2)),
        };
    }
}
