/**
 * Search Result Processing Utilities
 * 
 * Funções para:
 * 1. Deduplicação por equipmentId (mantendo melhor score)
 * 2. Cálculo de confidenceItem monótona com rankScore
 * 3. Conversão de métricas agregadas para API
 */

import type { SearchResultItem } from '../domain/searchEngine.js';

// =============================================================================
// Deduplicação por equipmentId
// =============================================================================

/**
 * Remove duplicatas por equipmentId, mantendo o item com maior rankScore
 * 
 * REGRA: 1 equipmentId aparece no máximo 1 vez no resultado
 * 
 * Quando há múltiplos candidatos para o mesmo equipmentId:
 * - Mantém o que tem maior rankScore
 * - Preserva provenance (quais variantes contribuíram) em metadata
 * 
 * @param items Lista de resultados (pode conter duplicados)
 * @returns Lista dedupicada
 */
export function dedupByEquipmentId(items: SearchResultItem[]): SearchResultItem[] {
    if (items.length === 0) return items;
    
    // Agrupar por equipmentId
    const byEquipmentId = new Map<string, SearchResultItem[]>();
    
    for (const item of items) {
        // Se não tem equipmentId, usar grupo como fallback
        const key = item.equipmentId ?? item.grupo;
        
        if (!byEquipmentId.has(key)) {
            byEquipmentId.set(key, []);
        }
        
        byEquipmentId.get(key)!.push(item);
    }
    
    // Para cada grupo, escolher o melhor (maior rankScore)
    const deduped: SearchResultItem[] = [];
    
    for (const [equipmentId, candidates] of byEquipmentId.entries()) {
        if (candidates.length === 1) {
            deduped.push(candidates[0]);
            continue;
        }
        
        // Múltiplos candidatos: escolher maior rankScore
        // Usar rankScore se disponível, senão score_normalized
        const sorted = candidates.sort((a, b) => {
            const scoreA = a.rankScore ?? a.score_normalized ?? a.score;
            const scoreB = b.rankScore ?? b.score_normalized ?? b.score;
            return scoreB - scoreA;
        });
        
        const best = sorted[0];
        
        // Guardar provenance (opcional, para debug)
        // Quais variantes contribuíram?
        // TODO: adicionar campo provenance na interface ScoreBreakdown
        /*
        if (sorted.length > 1 && best.score_breakdown) {
            if (!best.score_breakdown.provenance) {
                best.score_breakdown.provenance = {
                    dedupApplied: true,
                    mergedVariants: sorted.length,
                    variantScores: sorted.slice(1).map(v => ({
                        grupo: v.grupo,
                        score: v.rankScore ?? v.score_normalized ?? v.score
                    }))
                };
            }
        }
        */
        
        deduped.push(best);
    }
    
    return deduped;
}

// =============================================================================
// Confidence monótona com rankScore
// =============================================================================

/**
 * Método de cálculo de confidence
 * 
 * DECISÃO: MinMax com normalização no topK
 * 
 * JUSTIFICATIVA:
 * - Simples e determinístico
 * - Garante que confidence[0] >= confidence[1] >= ... (monótono)
 * - Leve (sem exponenciais como softmax)
 * - Intuitivo: item com maior rank tem maior confidence
 * 
 * FÓRMULA:
 *   confidence = (rankScore - min) / (max - min)
 * 
 * ALTERNATIVA CONSIDERADA:
 * - Softmax: mais "probabilístico", mas overhead de exp() e normalização
 * - Se precisar ajustar no futuro, trocar método aqui
 */
export type ConfidenceMethod = 'minmax' | 'softmax';

export interface ConfidenceConfig {
    method: ConfidenceMethod;
    /** Temperatura para softmax (default: 1.0) */
    temperature?: number;
}

const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
    method: 'minmax',
    temperature: 1.0
};

/**
 * Calcula confidence para cada item usando MinMax
 * 
 * Normaliza scores no range [min, max] do topK para [0, 1]
 */
function calculateConfidenceMinMax(items: SearchResultItem[]): void {
    if (items.length === 0) return;
    
    // Pegar scores (usar rankScore se disponível)
    const scores = items.map(item => item.rankScore ?? item.score_normalized ?? item.score);
    
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // Edge case: todos têm mesmo score
    if (maxScore === minScore) {
        for (const item of items) {
            item.confidenceItem = 1.0;
        }
        return;
    }
    
    // MinMax normalization
    for (let i = 0; i < items.length; i++) {
        const score = scores[i];
        const normalized = (score - minScore) / (maxScore - minScore);
        items[i].confidenceItem = normalized;
    }
}

/**
 * Calcula confidence usando Softmax (alternativa)
 * 
 * Mais "probabilístico", mas com overhead de exp()
 * 
 * Formula: conf_i = exp(score_i / T) / sum(exp(score_j / T))
 */
function calculateConfidenceSoftmax(items: SearchResultItem[], temperature: number = 1.0): void {
    if (items.length === 0) return;
    
    // Pegar scores
    const scores = items.map(item => item.rankScore ?? item.score_normalized ?? item.score);
    
    // Calcular exponenciais (com temperatura)
    const expScores = scores.map(s => Math.exp(s / temperature));
    const sumExp = expScores.reduce((sum, exp) => sum + exp, 0);
    
    // Edge case
    if (sumExp === 0) {
        for (const item of items) {
            item.confidenceItem = 1 / items.length;
        }
        return;
    }
    
    // Softmax
    for (let i = 0; i < items.length; i++) {
        items[i].confidenceItem = expScores[i] / sumExp;
    }
}

/**
 * Calcula confidenceItem para todos os itens
 * 
 * IMPORTANTE:
 * - Deve ser chamado APÓS ordenação final por rankScore
 * - Garante que confidence é monótona: conf[i] >= conf[i+1]
 * 
 * @param items Lista de resultados (já ordenada por rankScore DESC)
 * @param config Configuração do método de confidence
 */
export function calculateConfidence(
    items: SearchResultItem[],
    config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): void {
    if (items.length === 0) return;
    
    // Validar que items está ordenado por rankScore (descrescente)
    // Se não estiver, ordenar agora
    const needsSort = items.some((item, i) => {
        if (i === 0) return false;
        const prevScore = items[i-1].rankScore ?? items[i-1].score_normalized ?? items[i-1].score;
        const currScore = item.rankScore ?? item.score_normalized ?? item.score;
        return currScore > prevScore;
    });
    
    if (needsSort) {
        items.sort((a, b) => {
            const scoreA = a.rankScore ?? a.score_normalized ?? a.score;
            const scoreB = b.rankScore ?? b.score_normalized ?? b.score;
            return scoreB - scoreA;
        });
    }
    
    // Aplicar método escolhido
    if (config.method === 'softmax') {
        calculateConfidenceSoftmax(items, config.temperature ?? 1.0);
    } else {
        // Default: MinMax
        calculateConfidenceMinMax(items);
    }
}

// =============================================================================
// Conversão de métricas agregadas para API
// =============================================================================

/**
 * Extrai valor display de métrica agregada, com fallback para formato legacy
 * 
 * Ordem de precedência:
 * 1. metrics.valorUnitario.display (v4.0)
 * 2. price (v3.0 legacy)
 * 3. undefined
 */
export function extractDisplayPrice(doc: any): number | undefined {
    if (doc.metrics?.valorUnitario?.display !== undefined) {
        return doc.metrics.valorUnitario.display;
    }
    
    if (doc.price !== undefined) {
        return doc.price;
    }
    
    return undefined;
}

/**
 * Extrai vida útil display
 */
export function extractDisplayLifespan(doc: any): number | undefined {
    if (doc.metrics?.vidaUtilMeses?.display !== undefined) {
        return doc.metrics.vidaUtilMeses.display;
    }
    
    if (doc.lifespanMonths !== undefined) {
        return doc.lifespanMonths;
    }
    
    return undefined;
}

/**
 * Extrai manutenção display
 * 
 * IMPORTANTE: converter de fração (0..1) para percentual (0..100) se necessário
 */
export function extractDisplayMaintenance(doc: any): number | undefined {
    if (doc.metrics?.manutencao?.display !== undefined) {
        const value = doc.metrics.manutencao.display;
        const unit = doc.metrics.manutencao.unit ?? 'fraction';
        
        // Se está em fração, converter para percentual
        if (unit === 'fraction') {
            return value * 100;
        }
        
        return value;
    }
    
    if (doc.maintenancePercent !== undefined) {
        return doc.maintenancePercent;
    }
    
    return undefined;
}

// =============================================================================
// Validação de coerência
// =============================================================================

/**
 * Valida se confidence está coerente com ranking
 * 
 * Critério: para todo i < j, confidence[i] >= confidence[j]
 * 
 * @returns true se coerente, false se há inversão
 */
export function validateConfidenceCoherence(items: SearchResultItem[]): {
    coherent: boolean;
    violations: Array<{ index: number; confidence: number; prevConfidence: number }>;
} {
    const violations: Array<{ index: number; confidence: number; prevConfidence: number }> = [];
    
    for (let i = 1; i < items.length; i++) {
        const prevConf = items[i-1].confidenceItem ?? 0;
        const currConf = items[i].confidenceItem ?? 0;
        
        // Permitir igualdade (>=), mas não inversão
        if (currConf > prevConf + 0.0001) { // Pequena tolerância para erros de float
            violations.push({
                index: i,
                confidence: currConf,
                prevConfidence: prevConf
            });
        }
    }
    
    return {
        coherent: violations.length === 0,
        violations
    };
}

/**
 * Valida se não há duplicados por equipmentId
 * 
 * @returns true se não há duplicados, false se há
 */
export function validateNoDuplicates(items: SearchResultItem[]): {
    valid: boolean;
    duplicates: Array<{ equipmentId: string; count: number }>;
} {
    const counts = new Map<string, number>();
    
    for (const item of items) {
        const key = item.equipmentId ?? item.grupo;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    
    const duplicates: Array<{ equipmentId: string; count: number }> = [];
    
    for (const [equipmentId, count] of counts.entries()) {
        if (count > 1) {
            duplicates.push({ equipmentId, count });
        }
    }
    
    return {
        valid: duplicates.length === 0,
        duplicates
    };
}
