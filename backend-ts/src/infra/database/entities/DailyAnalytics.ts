
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('daily_analytics')
export class DailyAnalytics {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'text', unique: true })
    date!: string; // YYYY-MM-DD

    @Column({ type: 'integer', default: 0 })
    total_queries!: number;

    @Column({ type: 'integer', default: 0 })
    zero_result_queries!: number;

    @Column({ type: 'float', default: 0 })
    avg_latency_ms!: number;

    @Column({ type: 'text', default: '{}' }) // Stored as JSON string
    top_terms_json!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
