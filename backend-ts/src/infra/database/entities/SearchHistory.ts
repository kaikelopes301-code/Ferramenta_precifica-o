/**
 * Database Entity: SearchHistory
 * 
 * Stores user search history for analytics and personalization.
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('search_history')
@Index(['user_id'])
@Index(['created_at'])
export class SearchHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    user_id!: string;

    @Column({ type: 'text' })
    query!: string;

    @Column({ type: 'text', nullable: true })
    context_tags!: string | null;

    @Column({ type: 'integer', default: 0 })
    results_count!: number;

    @CreateDateColumn({ type: 'datetime', precision: 3 })
    created_at!: Date;
}
