#!/usr/bin/env node
/**
 * Test Script - Search Validator (Golden Set)
 * 
 * Tests the /api/search endpoint with golden queries
 * 
 * NOTE: The 3-mode search (bm25/semantic/hybrid) is not yet deployed.
 * This script currently tests the production /api/search endpoint only.
 * 
 * Prerequisites:
 * - Node.js 18+ (for native fetch support)
 * - Backend server running (default: http://localhost:3000)
 * - Golden set file: tests/search_golden_set.json
 * 
 * Usage:
 *   SEARCH_BASE_URL=http://localhost:3000 npx tsx scripts/test_search_modes.ts
 *   
 * Output:
 *   tests/search_results_report.json
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = process.env.SEARCH_BASE_URL ?? 'http://localhost:3000';
const GOLDEN_SET_PATH = path.resolve(__dirname, '../tests/search_golden_set.json');
const REPORT_PATH = path.resolve(__dirname, '../tests/search_results_report.json');
const TOP_K = 10; // Number of results to request

// =============================================================================
// Types
// =============================================================================

interface GoldenQuery {
  id: string;
  descricao: string;
  tipo?: string;
  esperados?: string[];
  obs?: string;
}

interface ApiResultItem {
  id?: string;
  grupo?: string;
  descricao?: string;
  nome?: string;
  score?: number;
  score_normalized?: number;
  valor_unitario?: number;
  vida_util_meses?: number;
  manutencao_percent?: number;
  marca?: string;
  fornecedor?: string;
  [key: string]: unknown;
}

interface ApiResponse {
  resultados: ApiResultItem[];
  total?: number;
  query?: string;
  [key: string]: unknown;
}

interface SearchResultSummary {
  top1: ApiResultItem | null;
  top3: ApiResultItem[];
  httpStatus: number;
  httpHeaders: Record<string, string>;
  error?: string;

  // Business fields diagnostics (from TOP1)
  top1ValorUnitario: number | null;
  top1VidaUtil: number | null;
  top1Manutencao: number | null;
}

interface GoldenQueryReport {
  id: string;
  descricao: string;
  tipo?: string;
  esperados?: string[];
  obs?: string;
  result: SearchResultSummary;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract business field: valor unitário
 */
function extractValorUnitario(item: ApiResultItem | null): number | null {
  if (!item) return null;
  return typeof item.valor_unitario === 'number' ? item.valor_unitario : null;
}

/**
 * Extract business field: vida útil (lifespan)
 */
function extractVidaUtil(item: ApiResultItem | null): number | null {
  if (!item) return null;
  return typeof item.vida_util_meses === 'number' ? item.vida_util_meses : null;
}

/**
 * Extract business field: taxa de manutenção
 */
function extractManutencao(item: ApiResultItem | null): number | null {
  if (!item) return null;
  return typeof item.manutencao_percent === 'number' ? item.manutencao_percent : null;
}

/**
 * Normalize headers to lowercase keys
 */
function normalizeHeaders(headers: Headers): Record<string, string> {
  const normalized: Record<string, string> = {};
  headers.forEach((value, key) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

/**
 * Call /api/search endpoint
 */
async function callApiSearch(
  descricao: string,
  topK: number
): Promise<SearchResultSummary> {
  const url = `${BASE_URL}/api/search`;
  const body = {
    query: descricao,
    top_k: topK,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const httpStatus = response.status;
    const httpHeaders = normalizeHeaders(response.headers);

    // Try to parse JSON response
    let data: ApiResponse;
    try {
      data = await response.json() as ApiResponse;
    } catch (parseError) {
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      return {
        top1: null,
        top3: [],
        httpStatus,
        httpHeaders,
        error: `JSON parse error: ${errorMsg}`,
        top1ValorUnitario: null,
        top1VidaUtil: null,
        top1Manutencao: null,
        
      
      };
    }

    // Handle HTTP errors
    if (!response.ok) {
      return {
        top1: null,
        top3: [],
        httpStatus,
        httpHeaders,
        error: `HTTP ${httpStatus}: ${JSON.stringify(data)}`,
        top1ValorUnitario: null,
        top1VidaUtil: null,
        top1Manutencao: null,
      };
    }

    // Extract results
    const resultados = Array.isArray(data.resultados) ? data.resultados : [];
    const top1 = resultados.length > 0 ? resultados[0]! : null;
    const top3 = resultados.slice(0, 3);

    // Extract business fields from TOP1
    const top1ValorUnitario = extractValorUnitario(top1);
    const top1VidaUtil = extractVidaUtil(top1);
    const top1Manutencao = extractManutencao(top1);

    return {
      top1,
      top3,
      httpStatus,
      httpHeaders,
      top1ValorUnitario,
      top1VidaUtil,
      top1Manutencao,
    };

  } catch (error) {
    // Network or other error
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      top1: null,
      top3: [],
      httpStatus: 0,
      httpHeaders: {},
      error: `Network error: ${errorMsg}`,
      top1ValorUnitario: null,
      top1VidaUtil: null,
      top1Manutencao: null,
    };
  }
}

/**
 * Format item description for console output
 */
function formatItemDescription(item: ApiResultItem | null): string {
  if (!item) return '(nenhum resultado)';
  
  const id = item.id ?? item.grupo ?? '(sem ID)';
  const desc = item.descricao ?? item.nome ?? '(sem descrição)';
  const truncated = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
  
  return `${id} - ${truncated}`;
}

/**
 * Format business fields for console output
 */
function formatBusinessFields(
  valorUnitario: number | null,
  vidaUtil: number | null,
  manutencao: number | null
): string {
  const valor = valorUnitario !== null ? `R$ ${valorUnitario.toFixed(2)}` : 'N/A';
  const vida = vidaUtil !== null ? `${vidaUtil} meses` : 'N/A';
  const manut = manutencao !== null ? `${manutencao}%` : 'N/A';
  
  return `Valor: ${valor} | Vida útil: ${vida} | Manutenção: ${manut}`;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('🔍 Search Golden Set Test - /api/search');
  console.log('============================================================\n');

  console.log(`📍 Backend URL: ${BASE_URL}`);
  console.log(`📂 Golden set: ${GOLDEN_SET_PATH}`);
  console.log(`📄 Report output: ${REPORT_PATH}\n`);

  // 1. Load golden set
  console.log('📚 Loading golden set...');
  let goldenQueries: GoldenQuery[];
  try {
    const goldenSetContent = await readFile(GOLDEN_SET_PATH, 'utf-8');
    goldenQueries = JSON.parse(goldenSetContent) as GoldenQuery[];
    console.log(`✅ Loaded ${goldenQueries.length} queries\n`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to load golden set: ${errorMsg}`);
    process.exit(1);
  }

  // 2. Test each query
  const reports: GoldenQueryReport[] = [];

  for (let i = 0; i < goldenQueries.length; i++) {
    const query = goldenQueries[i]!;
    const progress = `[${i + 1}/${goldenQueries.length}]`;

    console.log('─'.repeat(80));
    console.log(`${progress} Testing query "${query.id}"`);
    console.log(`   Descrição: "${query.descricao}"`);
    console.log(`   Tipo: ${query.tipo ?? 'N/A'}\n`);

    const result = await callApiSearch(query.descricao, TOP_K);

    // Log results
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      console.log(`   ✅ HTTP ${result.httpStatus}`);
      console.log(`   🏆 TOP1: ${formatItemDescription(result.top1)}`);
      
      if (result.top1) {
        console.log(`       ${formatBusinessFields(
          result.top1ValorUnitario,
          result.top1VidaUtil,
          result.top1Manutencao
        )}`);
      }
    }
    console.log();

    // Build report for this query
    const report: GoldenQueryReport = {
      id: query.id,
      descricao: query.descricao,
      tipo: query.tipo,
      esperados: query.esperados,
      obs: query.obs,
      result,
    };

    reports.push(report);
  }

  // 3. Save report
  console.log('─'.repeat(80));
  console.log('\n💾 Saving report...');
  try {
    const reportJson = JSON.stringify(reports, null, 2);
    await writeFile(REPORT_PATH, reportJson, 'utf-8');
    console.log(`✅ Report saved to: ${REPORT_PATH}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to save report: ${errorMsg}`);
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('✅ All tests completed successfully!');
  console.log('============================================================\n');

  // 4. Summary statistics
  const totalQueries = reports.length;
  let successfulQueries = 0;

  for (const report of reports) {
    if (!report.result.error && report.result.top1) successfulQueries++;
  }

  console.log('📊 Summary:');
  console.log(`   Total queries: ${totalQueries}`);
  console.log(`   Successful: ${successfulQueries}/${totalQueries} (${((successfulQueries/totalQueries)*100).toFixed(1)}%)`);
  console.log();
}

// Execute
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
