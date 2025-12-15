
import { AppDataSource } from '../../../infra/database/connection.js';
import { DailyAnalytics } from '../../../infra/database/entities/DailyAnalytics.js';

interface AnalyticsBuffer {
    totalQueries: number;
    zeroResultQueries: number;
    totalLatency: number;
    topTerms: Record<string, number>;
    lastFlush: number;
}

export class AnalyticsService {
    private buffer: AnalyticsBuffer = this.getEmptyBuffer();
    private flushIntervalMs = 1000 * 60 * 5; // 5 minutes
    private flushTimer: NodeJS.Timeout | null = null;
    private static instance: AnalyticsService;

    private constructor() {
        this.startFlushTimer();
    }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    private getEmptyBuffer(): AnalyticsBuffer {
        return {
            totalQueries: 0,
            zeroResultQueries: 0,
            totalLatency: 0,
            topTerms: {},
            lastFlush: Date.now()
        };
    }

    public trackQuery(query: string, resultCount: number, latencyMs: number) {
        this.buffer.totalQueries++;
        if (resultCount === 0) {
            this.buffer.zeroResultQueries++;
        }
        this.buffer.totalLatency += latencyMs;

        const normalized = query.trim().toLowerCase();
        if (normalized.length > 2) {
            this.buffer.topTerms[normalized] = (this.buffer.topTerms[normalized] || 0) + 1;
        }
    }

    public async flush(): Promise<void> {
        if (this.buffer.totalQueries === 0) return;
        if (!AppDataSource.isInitialized) return;

        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const repo = AppDataSource.getRepository(DailyAnalytics);

        try {
            // Transaction to ensure atomic update if possible, but minimal lock
            let analytics = await repo.findOneBy({ date });

            if (!analytics) {
                analytics = new DailyAnalytics();
                analytics.date = date;
                analytics.top_terms_json = '{}';
                analytics.total_queries = 0;
                analytics.zero_result_queries = 0;
                analytics.avg_latency_ms = 0;
            }

            const currentBuffer = { ...this.buffer };
            // Reset buffer immediately to capture new queries during await
            this.buffer = this.getEmptyBuffer();

            const prevQty = analytics.total_queries;
            const prevAvg = analytics.avg_latency_ms;
            const prevSum = prevQty * prevAvg;

            const newSum = prevSum + currentBuffer.totalLatency;
            const newQty = prevQty + currentBuffer.totalQueries;

            analytics.total_queries = newQty;
            analytics.avg_latency_ms = newQty > 0 ? newSum / newQty : 0;
            analytics.zero_result_queries += currentBuffer.zeroResultQueries;

            // Merge terms
            const currentTerms = JSON.parse(analytics.top_terms_json);
            for (const [term, count] of Object.entries(currentBuffer.topTerms)) {
                currentTerms[term] = (currentTerms[term] || 0) + count;
            }
            analytics.top_terms_json = JSON.stringify(currentTerms);

            await repo.save(analytics);

            // console.log(`[Analytics] Flushed ${currentBuffer.totalQueries} queries`);

        } catch (error) {
            console.error('[Analytics] Failed to flush:', error);
            // Restore buffer (simple retry logic could be added)
        }
    }

    private startFlushTimer() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    }

    public stop() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        return this.flush();
    }

    // Helper for testing
    public getBuffer() {
        return this.buffer;
    }
}
