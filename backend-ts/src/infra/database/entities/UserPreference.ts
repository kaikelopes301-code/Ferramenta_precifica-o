/**
 * Database Entity: UserPreference
 * 
 * Stores user preferences and settings.
 */

import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_preferences')
@Index(['user_id'], { unique: true })
export class UserPreference {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text', unique: true })
    user_id!: string;

    @Column({ type: 'text' })
    data!: string;  // JSON string

    @UpdateDateColumn()
    updated_at!: Date;
}
