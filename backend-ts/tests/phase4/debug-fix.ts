
import fs from 'fs/promises';
import path from 'path';

class DataService {
    constructor() {
        this.dataPath = path.join(process.cwd(), '..', 'data', 'dataset_ts.json');
        console.log('[DEBUG] Path:', this.dataPath);
    }

    async loadDataset() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf-8');
            console.log('[DEBUG] File read success, size:', data.length);
            return JSON.parse(data);
        } catch (error) {
            console.error('[DEBUG] Error loading:', error.message);
            return [];
        }
    }

    async getDatasetStatus() {
        console.log('[DEBUG] Getting status...');
        const products = await this.loadDataset();
        console.log('[DEBUG] Products count:', products.length);

        // ... logic ...
        return {
            dataset: { total: products.length },
            statistics: { avg: 0 }
        };
    }
}

async function test() {
    const service = new DataService();
    try {
        const data = await service.getDatasetStatus();
        console.log('Result:', data);
    } catch (e) {
        console.error('Fatal:', e);
    }
}

test();
