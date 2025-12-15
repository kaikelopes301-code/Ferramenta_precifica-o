/**
 * Database Entity: Favorite
 * 
 * Stores user favorite items for quick access.
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('favorites')
@Index(['user_id'])
export class Favorite {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    user_id!: string;

    @Column({ type: 'text' })
    item_name!: string;

    @Column({ type: 'real', nullable: true })
    price!: number | null;

    @Column({ type: 'text', nullable: true })
    extra!: string | null;  // JSON string

    @CreateDateColumn()
    created_at!: Date;
}
