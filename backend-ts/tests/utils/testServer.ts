/**
 * Test Server Utility
 * 
 * Manages the lifecycle of a REAL HTTP server for E2E testing.
 * Ensures complete integration testing including:
 * - Database initialization
 * - Search engine initialization
 * - HTTP server startup
 * - Graceful shutdown with cleanup
 * 
 * @version 1.0.0
 */

import type { FastifyInstance } from 'fastify';
import { initializeApp } from '../../src/api/index.js';
import { initializeDatabase, closeDatabase } from '../../src/infra/database/connection.js';
import { AnalyticsService } from '../../src/domain/services/analytics/AnalyticsService.js';

interface TestServerConfig {
    port?: number;
    host?: string;
    databasePath?: string;
    logLevel?: string;
}

export class TestServer {
    private app: FastifyInstance | null = null;
    private config: Required<TestServerConfig>;
    public baseURL: string;
    private previousEnv: {
        DATABASE_PATH?: string;
        LOG_LEVEL?: string;
        PORT?: string;
    } | null = null;

    constructor(config: TestServerConfig = {}) {
        this.config = {
            port: config.port ?? 4000,
            host: config.host ?? '127.0.0.1',
            databasePath: config.databasePath ?? ':memory:', // In-memory by default
            logLevel: config.logLevel ?? 'error', // Quiet by default
        };

        this.baseURL = `http://${this.config.host}:${this.config.port}`;
    }

    /**
     * Start the complete server stack
     * 
     * Steps:
     * 1. Configure environment
     * 2. Initialize database
     * 3. Initialize application (search engine, routes, etc.)
     * 4. Start HTTP server
     * 5. Wait for health check to pass
     */
    async start(): Promise<void> {
        console.log(`[TestServer] 🚀 Starting test server on ${this.baseURL}...`);

        try {
            // 1. Configure environment
            this.previousEnv = {
                DATABASE_PATH: process.env.DATABASE_PATH,
                LOG_LEVEL: process.env.LOG_LEVEL,
                PORT: process.env.PORT,
            };
            process.env.DATABASE_PATH = this.config.databasePath;
            process.env.LOG_LEVEL = this.config.logLevel;
            process.env.PORT = String(this.config.port);

            // 2. Initialize database
            console.log('[TestServer] 📦 Initializing database...');
            await initializeDatabase();

            // 3. Initialize application (includes search engine)
            console.log('[TestServer] 🔍 Initializing application...');
            this.app = await initializeApp();

            // 4. Start HTTP server
            console.log(`[TestServer] 🌐 Starting HTTP server on port ${this.config.port}...`);
            await this.app.listen({
                port: this.config.port,
                host: this.config.host,
            });

            // 5. Wait for server to be ready
            await this.waitForReady();

            console.log(`[TestServer] ✅ Test server ready at ${this.baseURL}`);
        } catch (error) {
            console.error('[TestServer] ❌ Failed to start:', error);
            await this.stop(); // Cleanup partial initialization
            throw error;
        }
    }

    /**
     * Stop the server and cleanup resources
     * 
     * Steps:
     * 1. Flush analytics
     * 2. Close HTTP server
     * 3. Close database connection
     */
    async stop(): Promise<void> {
        console.log('[TestServer] 🛑 Stopping test server...');

        try {
            // 1. Flush analytics (if any pending)
            try {
                await AnalyticsService.getInstance().stop();
                console.log('[TestServer] 📊 Analytics flushed');
            } catch (error) {
                console.warn('[TestServer] ⚠️  Analytics flush error:', error);
            }

            // 2. Close HTTP server
            if (this.app) {
                await this.app.close();
                this.app = null;
                console.log('[TestServer] 🌐 HTTP server closed');
            }

            // 3. Close database
            try {
                await closeDatabase();
                console.log('[TestServer] 💾 Database closed');
            } catch (error) {
                console.warn('[TestServer] ⚠️  Database close error:', error);
            }

            // 4. Restore environment variables to avoid leaking state between test files
            if (this.previousEnv) {
                if (this.previousEnv.DATABASE_PATH === undefined) {
                    delete process.env.DATABASE_PATH;
                } else {
                    process.env.DATABASE_PATH = this.previousEnv.DATABASE_PATH;
                }

                if (this.previousEnv.LOG_LEVEL === undefined) {
                    delete process.env.LOG_LEVEL;
                } else {
                    process.env.LOG_LEVEL = this.previousEnv.LOG_LEVEL;
                }

                if (this.previousEnv.PORT === undefined) {
                    delete process.env.PORT;
                } else {
                    process.env.PORT = this.previousEnv.PORT;
                }

                this.previousEnv = null;
            }

            console.log('[TestServer] ✅ Test server stopped');
        } catch (error) {
            console.error('[TestServer] ❌ Error during shutdown:', error);
            throw error;
        }
    }

    /**
     * Wait for server to be ready by polling health endpoint
     */
    private async waitForReady(maxAttempts = 30, intervalMs = 100): Promise<void> {
        console.log('[TestServer] ⏳ Waiting for server to be ready...');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(`${this.baseURL}/api/health`);
                if (response.ok) {
                    console.log(`[TestServer] ✅ Server ready after ${attempt} attempt(s)`);
                    return;
                }
            } catch (error) {
                // Server not ready yet, continue polling
            }

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        throw new Error(`[TestServer] Server failed to become ready after ${maxAttempts} attempts`);
    }

    /**
     * Get the Fastify app instance (for direct injection testing if needed)
     */
    getApp(): FastifyInstance {
        if (!this.app) {
            throw new Error('[TestServer] Server not started');
        }
        return this.app;
    }

    /**
     * Helper: Make HTTP request to server
     */
    async request(path: string, options: RequestInit = {}): Promise<Response> {
        const url = `${this.baseURL}${path}`;
        return fetch(url, options);
    }
}

// Singleton instance for test suites
let globalTestServer: TestServer | null = null;

/**
 * Get or create the global test server instance
 */
export function getTestServer(config?: TestServerConfig): TestServer {
    if (!globalTestServer) {
        globalTestServer = new TestServer(config);
    }
    return globalTestServer;
}

/**
 * Start the global test server
 */
export async function startTestServer(config?: TestServerConfig): Promise<TestServer> {
    const server = getTestServer(config);
    await server.start();
    return server;
}

/**
 * Stop the global test server
 */
export async function stopTestServer(): Promise<void> {
    if (globalTestServer) {
        await globalTestServer.stop();
        globalTestServer = null;
    }
}
