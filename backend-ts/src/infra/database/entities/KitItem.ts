/**
 * Database Entity: KitItem
 * 
 * Stores items in user's kit/budget for quotation generation.
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('kit_items')
@Index(['user_id'])
export class KitItem {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    user_id!: string;

    @Column({ type: 'text' })
    item_name!: string;

    @Column({ type: 'real', nullable: true })
    price!: number | null;

    @Column({ type: 'integer', default: 1 })
    qty!: number;

    @Column({ type: 'text', nullable: true })
    extra!: string | null;  // JSON string

    @CreateDateColumn()
    created_at!: Date;
}
