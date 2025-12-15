/**
 * Data Service - Dataset Statistics
 * 
 * Handles loading and analysis of equipment dataset.
 * Uses robust currency parsing for Brazilian Real (BRL) values.
 */

import fs from 'fs/promises';
import path from 'path';
import { parseBRLCurrency } from '../../utils/currency.js';

export class DataService {
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), '..', 'data', 'dataset_ts.json');
  }

  async loadDataset(): Promise<any[]> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      const parsed = JSON.parse(data);
      // Dataset has structure { metadata: {}, corpus: [] }
      return Array.isArray(parsed.corpus) ? parsed.corpus : [];
    } catch (error) {
      console.error('[DataService] Error loading dataset:', error);
      return [];
    }
  }

  async getDatasetStatus() {
    const products = await this.loadDataset();

    // Ensure products is an array
    if (!Array.isArray(products)) {
      console.error('[DataService] Dataset is not an array:', typeof products);
      // Return empty dataset status instead of throwing
      return {
        dataset: {
          total_products: 0,
          last_updated: new Date().toISOString(),
          source: path.basename(this.dataPath),
          status: 'error' as const,
        },
        statistics: {
          avg_price: 0,
          min_price: 0,
          max_price: 0,
          categories: 0,
        },
      };
    }

    // Robust Price Parsing using utility function
    const prices = products
      .map((p, index) => {
        const price = parseBRLCurrency(p.preco, `product[${index}]`);
        return price;
      })
      .filter(p => p > 0);

    const avgPrice = prices.length > 0
      ? prices.reduce((sum, p) => sum + p, 0) / prices.length
      : 0;

    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Count categories
    const categories = new Set(
      products.map(p => p.categoria || p.category).filter(c => c)
    ).size;

    let lastUpdated: Date;
    let source: string;
    try {
      const stats = await fs.stat(this.dataPath);
      lastUpdated = stats.mtime;
      source = path.basename(this.dataPath);
    } catch {
      lastUpdated = new Date();
      source = 'unknown';
    }

    return {
      dataset: {
        total_products: products.length,
        last_updated: lastUpdated.toISOString(),
        source,
        status: products.length > 0 ? 'loaded' : 'empty',
      },
      statistics: {
        avg_price: Number(avgPrice.toFixed(2)),
        min_price: Number(minPrice.toFixed(2)),
        max_price: Number(maxPrice.toFixed(2)),
        categories: categories || 0,
      },
    };
  }
}
