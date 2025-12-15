/**
 * Database Connection and Configuration
 * 
 * Sets up SQLite database with TypeORM for persistent storage.
 * Uses WAL mode for better concurrent access.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'path';
import { SearchHistory } from './entities/SearchHistory.js';
import { Favorite } from './entities/Favorite.js';
import { KitItem } from './entities/KitItem.js';
import { UserPreference } from './entities/UserPreference.js';

import { DailyAnalytics } from './entities/DailyAnalytics.js';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: DB_PATH,
    synchronize: true,  // Auto-create tables (dev only, use migrations in prod)
    logging: process.env.LOG_LEVEL === 'debug',
    entities: [SearchHistory, Favorite, KitItem, UserPreference, DailyAnalytics],

    // SQLite optimizations
    extra: {
        // Enable WAL mode for better concurrent access
        'journal_mode': 'WAL',
        // Increase cache size (in pages, -2000 = ~8MB)
        'cache_size': -2000,
        // Enable foreign keys
        'foreign_keys': true,
        // Synchronous mode for better performance
        'synchronous': 'NORMAL',
    },
});

let isInitialized = false;

export async function initializeDatabase(): Promise<void> {
    if (isInitialized) {
        return;
    }

    try {
        await AppDataSource.initialize();
        console.log('[Database] ✅ Connected to SQLite database');
        console.log(`[Database] 📁 Path: ${DB_PATH}`);

        // Enable WAL mode explicitly
        await AppDataSource.query('PRAGMA journal_mode = WAL;');
        await AppDataSource.query('PRAGMA foreign_keys = ON;');

        isInitialized = true;
    } catch (error) {
        console.error('[Database] ❌ Failed to initialize:', error);
        throw error;
    }
}

export async function closeDatabase(): Promise<void> {
    if (isInitialized && AppDataSource.isInitialized) {
        await AppDataSource.destroy();
        isInitialized = false;
        console.log('[Database] 👋 Connection closed');
    }
}

export { SearchHistory, Favorite, KitItem, UserPreference };
