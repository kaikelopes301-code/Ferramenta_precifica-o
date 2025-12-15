
import { DataService } from '../../src/domain/services/DataService.js';

async function test() {
    const service = new DataService();
    console.log('Path:', service['dataPath']);

    try {
        const data = await service.getDatasetStatus();
        console.log('Status:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
