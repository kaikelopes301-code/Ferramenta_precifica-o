/**
 * User Preferences Repository
 * 
 * Handles CRUD operations for user preferences and settings.
 */

import { Repository } from 'typeorm';
import { AppDataSource, UserPreference } from '../../infra/database/connection.js';
import type { UserPreferencesDTO } from '../../contracts/dto.types.js';
import { isUserPreferencesDTO } from '../../contracts/dto.types.js';

export class UserPreferencesRepository {
    private repo: Repository<UserPreference>;

    constructor() {
        this.repo = AppDataSource.getRepository(UserPreference);
    }

    async findByUserId(user_id: string): Promise<UserPreference | null> {
        return await this.repo.findOneBy({ user_id });
    }

    async findAll(): Promise<UserPreference[]> {
        return await this.repo.find();
    }

    async upsert(user_id: string, data: UserPreferencesDTO): Promise<UserPreference> {
        const existing = await this.findByUserId(user_id);

        const dataString = JSON.stringify(data);

        if (existing) {
            existing.data = dataString;
            return await this.repo.save(existing);
        } else {
            const entity = this.repo.create({
                user_id,
                data: dataString,
            });
            return await this.repo.save(entity);
        }
    }

    async delete(user_id: string): Promise<boolean> {
        const result = await this.repo.delete({ user_id });
        return (result.affected ?? 0) > 0;
    }

    /**
     * Get parsed preferences data with type safety
     */
    async getPreferences(user_id: string): Promise<UserPreferencesDTO> {
        const pref = await this.findByUserId(user_id);
        if (!pref) {
            return {};
        }

        try {
            const parsed: unknown = JSON.parse(pref.data);
            
            // Validate structure before returning
            if (isUserPreferencesDTO(parsed)) {
                return parsed;
            }
            
            // If validation fails, return empty object (data corruption scenario)
            console.warn(`[UserPreferencesRepository] Invalid preferences data for user ${user_id}`);
            return {};
        } catch (error) {
            console.error(`[UserPreferencesRepository] Failed to parse preferences for user ${user_id}:`, error);
            return {};
        }
    }

    /**
     * Update context tags for user
     */
    async updateContextTags(user_id: string, tags: string[]): Promise<string[]> {
        const currentPrefs = await this.getPreferences(user_id);
        currentPrefs.context_tags = tags;
        await this.upsert(user_id, currentPrefs);
        return tags;
    }
}
