/**
 * SearchResultComparator - Compara resultados de busca entre Python e TypeScript
 * 
 * Calcula métricas de similaridade entre dois conjuntos de resultados:
 * - Jaccard similarity: proporção de IDs em comum
 * - Rank difference: diferença média de posições
 * - Score MAE: erro absoluto médio dos scores
 */

import type { SearchResult, SearchResultItem } from './searchEngine.js';

export interface ComparisonMetrics {
  /** Coeficiente de Jaccard: |A ∩ B| / |A ∪ B| (0.0 a 1.0) */
  jaccardSimilarity: number;

  /** Diferença média de rank (0.0 = perfeito, maior = piores diferenças) */
  rankDifference: number;

  /** Erro absoluto médio dos scores (0.0 = perfeito) */
  scoreMae: number;

  /** IDs encontrados apenas em Python */
  pythonOnlyIds: string[];

  /** IDs encontrados apenas em TypeScript */
  tsOnlyIds: string[];

  /** Top 5 documentos com maior diferença de score */
  topScoreDifferences: Array<{
    id: string;
    pythonScore: number;
    tsScore: number;
    difference: number;
  }>;
}

export interface DetailedComparison {
  query: string;
  metrics: ComparisonMetrics;
  pythonResult: SearchResult;
  tsResult: SearchResult;
  timestamp: string;
}

export interface SearchResultComparator {
  /**
   * Compara dois resultados de busca e retorna métricas de similaridade
   */
  compare(pythonResult: SearchResult, tsResult: SearchResult): ComparisonMetrics;

  /**
   * Cria um relatório detalhado da comparação (para logging)
   */
  createDetailedComparison(
    query: string,
    pythonResult: SearchResult,
    tsResult: SearchResult
  ): DetailedComparison;

  /**
   * Determina se a diferença entre resultados está dentro do threshold aceitável
   */
  isWithinThreshold(metrics: ComparisonMetrics): boolean;
}

export interface SearchResultComparatorConfig {
  /** Jaccard mínimo aceitável (default: 0.7) */
  minJaccardSimilarity?: number;

  /** Rank difference máxima aceitável (default: 2.0) */
  maxRankDifference?: number;

  /** Score MAE máximo aceitável (default: 0.05) */
  maxScoreMae?: number;

  /** Número de top score differences a reportar (default: 5) */
  topDifferencesCount?: number;
}

export class DefaultSearchResultComparator implements SearchResultComparator {
  private readonly minJaccardSimilarity: number;
  private readonly maxRankDifference: number;
  private readonly maxScoreMae: number;
  private readonly topDifferencesCount: number;

  constructor(config: SearchResultComparatorConfig = {}) {
    this.minJaccardSimilarity = config.minJaccardSimilarity ?? 0.7;
    this.maxRankDifference = config.maxRankDifference ?? 2.0;
    this.maxScoreMae = config.maxScoreMae ?? 0.05;
    this.topDifferencesCount = config.topDifferencesCount ?? 5;
  }

  compare(pythonResult: SearchResult, tsResult: SearchResult): ComparisonMetrics {
    // Extrair IDs dos resultados
    const pythonIds = new Set(pythonResult.resultados.map((r: SearchResultItem) => r.grupo));
    const tsIds = new Set(tsResult.resultados.map((r: SearchResultItem) => r.grupo));

    // Calcular Jaccard similarity
    const intersection = new Set([...pythonIds].filter((id) => tsIds.has(id)));
    const union = new Set([...pythonIds, ...tsIds]);
    const jaccardSimilarity = union.size === 0 ? 1.0 : intersection.size / union.size;

    // IDs exclusivos
    const pythonOnlyIds = [...pythonIds].filter((id) => !tsIds.has(id));
    const tsOnlyIds = [...tsIds].filter((id) => !pythonIds.has(id));

    // Criar mapas de posição e score
    const pythonRanks = new Map(
      pythonResult.resultados.map((r: SearchResultItem, idx: number) => [r.grupo, idx])
    );
    const tsRanks = new Map(tsResult.resultados.map((r: SearchResultItem, idx: number) => [r.grupo, idx]));

    const pythonScores = new Map(
      pythonResult.resultados.map((r: SearchResultItem) => [r.grupo, r.score])
    );
    const tsScores = new Map(tsResult.resultados.map((r: SearchResultItem) => [r.grupo, r.score]));

    // Calcular rank difference (apenas para IDs em comum)
    const commonIds = [...intersection] as string[];
    let totalRankDiff = 0;
    for (const id of commonIds) {
      const pythonRank = pythonRanks.get(id) as number;
      const tsRank = tsRanks.get(id) as number;
      totalRankDiff += Math.abs(pythonRank - tsRank);
    }
    const rankDifference = commonIds.length === 0 ? 0.0 : totalRankDiff / commonIds.length;

    // Calcular score MAE (apenas para IDs em comum)
    let totalScoreDiff = 0;
    const scoreDifferences: Array<{
      id: string;
      pythonScore: number;
      tsScore: number;
      difference: number;
    }> = [];

    for (const id of commonIds) {
      const pythonScore = pythonScores.get(id) as number;
      const tsScore = tsScores.get(id) as number;
      const diff = Math.abs(pythonScore - tsScore);
      totalScoreDiff += diff;
      scoreDifferences.push({
        id: id as string,
        pythonScore,
        tsScore,
        difference: diff,
      });
    }

    const scoreMae = commonIds.length === 0 ? 0.0 : totalScoreDiff / commonIds.length;

    // Top score differences
    const topScoreDifferences = scoreDifferences
      .sort((a, b) => b.difference - a.difference)
      .slice(0, this.topDifferencesCount);

    return {
      jaccardSimilarity,
      rankDifference,
      scoreMae,
      pythonOnlyIds: pythonOnlyIds as string[],
      tsOnlyIds: tsOnlyIds as string[],
      topScoreDifferences,
    };
  }

  createDetailedComparison(
    query: string,
    pythonResult: SearchResult,
    tsResult: SearchResult
  ): DetailedComparison {
    const metrics = this.compare(pythonResult, tsResult);
    return {
      query,
      metrics,
      pythonResult,
      tsResult,
      timestamp: new Date().toISOString(),
    };
  }

  isWithinThreshold(metrics: ComparisonMetrics): boolean {
    return (
      metrics.jaccardSimilarity >= this.minJaccardSimilarity &&
      metrics.rankDifference <= this.maxRankDifference &&
      metrics.scoreMae <= this.maxScoreMae
    );
  }
}
