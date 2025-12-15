#!/usr/bin/env node
/**
 * Dataset Aggregator - Resolve duplicatas e agrega métricas por equipmentId
 * 
 * PROBLEMA: O buildDataset.ts atual pega apenas o PRIMEIRO exemplar de cada grupo,
 * gerando valores inconsistentes quando há múltiplas linhas com preços/vidas úteis diferentes.
 * 
 * SOLUÇÃO: Agregar numericamente todos os exemplares de cada item:
 * - 1 equipmentId = 1 documento final
 * - Valores: { display, mean, median, min, max, n }
 * - Rastreabilidade completa (stats + sources)
 * 
 * Uso:
 *   npm run aggregate-dataset
 *   ou
 *   tsx scripts/aggregateDataset.ts
 */

import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeEquipment, normalizeText, parseBrazilianNumber } from '../utils/textNormalization.js';
import { detectCategory, detectDocType, type DocCategory, type DocType } from '../search/semantic/taxonomy.js';

// =============================================================================
// Configuration
// =============================================================================

const findRootDir = (): string => {
    let currentDir = process.cwd();
    if (currentDir.endsWith('backend-ts')) {
        return path.resolve(currentDir, '..');
    }
    return currentDir;
};

const ROOT_DIR = findRootDir();
const EXCEL_PATH = path.join(ROOT_DIR, 'data', 'dados_internos.xlsx');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'dataset_ts.json');
const SHEET_NAME = 'dados';

// Column mappings
const COLUMNS = {
    fonte: 'Bid ou Fonte',
    fornecedor: 'Fornecedor',
    marca: 'marca',
    descricao: 'Descrição',
    descricao_saneada: 'Descrição Saneada',
    descricao_padronizada: 'Descrição Padronizada',
    valor_unitario: 'Valor Unitário',
    vida_util_meses: 'Vida Útil (meses)',
    manutencao: 'Manutenção (%)'
};

// =============================================================================
// Types
// =============================================================================

interface ExcelRow {
    [key: string]: any;
}

interface NumericMetrics {
    display: number;          // Valor usado para exibição (mediana ou média)
    mean: number;             // Média aritmética
    median: number;           // Mediana (mais robusta que média)
    min: number;              // Valor mínimo
    max: number;              // Valor máximo
    n: number;                // Quantidade de amostras
    unit?: 'fraction' | 'percent'; // Para manutenção
}

interface AggregatedDocument {
    id: string;
    equipmentId: string;      // Chave canônica estável
    title: string;            // Descrição limpa para display
    text: string;             // Texto normalizado para busca
    rawText: string;          // Texto original completo
    semanticText: string;     // Texto enriquecido para embeddings

    // Taxonomia (build-time): persistir no doc para uso em runtime/reranker
    docCategory?: DocCategory;
    docType?: DocType;
    
    // Métricas agregadas
    metrics: {
        valorUnitario?: NumericMetrics;
        vidaUtilMeses?: NumericMetrics;
        manutencao?: NumericMetrics;
    };
    
    // Provenance/rastreabilidade
    sources: {
        fornecedores: string[];
        bids: string[];
        marcas: string[];
        nLinhas: number;
    };
}

interface DatasetOutput {
    metadata: {
        description: string;
        source: string;
        exportedAt: string;
        aggregationMethod: string;
        displayValueMethod: 'median' | 'trimmed_mean';
        originalRows: number;
        uniqueEquipments: number;
        version: string;
    };
    corpus: AggregatedDocument[];
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Cria equipmentId determinístico e estável
 * 
 * Regras:
 * - lowercase
 * - sem acentos
 * - trim
 * - espaços únicos
 * - remove caracteres especiais
 */
function buildEquipmentId(descricaoPadronizada: string): string {
    if (!descricaoPadronizada) return '';

    // Única fonte de verdade (compatível com runtime): normalizeText()
    return normalizeText(descricaoPadronizada);
}

/**
 * Calcula estatísticas numéricas de um array de valores
 */
function calculateMetrics(values: number[]): Omit<NumericMetrics, 'display'> {
    if (values.length === 0) {
        return { mean: 0, median: 0, min: 0, max: 0, n: 0 };
    }
    
    // Ordenar para calcular mediana
    const sorted = [...values].sort((a, b) => a - b);
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    return { mean, median, min, max, n: values.length };
}

/**
 * Calcula média aparada (trimmed mean) - remove 10% superior e inferior
 * Mais robusta que média simples, menos sensível a outliers que mediana
 */
function calculateTrimmedMean(values: number[], trimPercent: number = 0.1): number {
    if (values.length === 0) return 0;
    if (values.length <= 2) return values.reduce((sum, v) => sum + v, 0) / values.length;
    
    const sorted = [...values].sort((a, b) => a - b);
    const trimCount = Math.floor(sorted.length * trimPercent);
    
    // Remove trimCount elementos de cada extremo
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    
    if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
    
    return trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;
}

/**
 * Escolhe valor de display (DECISÃO: mediana)
 * 
 * JUSTIFICATIVA:
 * - Mediana é robusta a outliers (preços muito altos/baixos de fornecedores específicos)
 * - Não é influenciada por valores extremos (melhor que média)
 * - Representativa do "valor típico" do mercado
 * - Simples de explicar ao cliente
 * 
 * ALTERNATIVA CONSIDERADA:
 * - Trimmed mean (média aparada 10%): também robusta, mas menos intuitiva
 * - Se precisar ajustar no futuro, trocar por calculateTrimmedMean()
 */
function selectDisplayValue(metrics: Omit<NumericMetrics, 'display'>): number {
    // DECISÃO: usar mediana como valor padrão
    return metrics.median;
    
    // ALTERNATIVA (comentada): usar média aparada
    // return calculateTrimmedMean(originalValues);
}

/**
 * Valida se um valor é válido
 */
function isValidValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (typeof value === 'number' && isNaN(value)) return false;
    return true;
}

/**
 * Normaliza valor de manutenção para fração (0..1)
 * 
 * DECISÃO: armazenar como fração (0..1) internamente
 * - Mais preciso para cálculos
 * - Frontend pode converter para % quando exibir
 * - Evita ambiguidade (5 = 5% ou 0.05?)
 */
function normalizeMaintenancePercent(value: number): number {
    // Se valor > 1, assume que está em percentual (ex: 5 = 5%)
    // Converte para fração: 5% → 0.05
    if (value > 1) {
        return value / 100;
    }
    // Se <= 1, já está em fração
    return value;
}

// =============================================================================
// Dataset Building
// =============================================================================

/**
 * Lê arquivo Excel
 */
function readExcelFile(filePath: string, sheetName: string): ExcelRow[] {
    console.log(`📖 Lendo arquivo Excel: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo Excel não encontrado: ${filePath}`);
    }
    
    const workbook = XLSX.readFile(filePath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
        console.log(`⚠️  Aba "${sheetName}" não encontrada. Abas disponíveis:`, workbook.SheetNames);
        const firstSheet = workbook.SheetNames[0];
        console.log(`   Usando primeira aba: "${firstSheet}"`);
        const worksheet = workbook.Sheets[firstSheet];
        return XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
    
    console.log(`   ✅ ${rows.length} linhas lidas da aba "${sheetName}"`);
    
    return rows;
}

/**
 * Agrega linhas por equipmentId
 */
function aggregateByEquipmentId(rows: ExcelRow[]): Map<string, ExcelRow[]> {
    console.log('\n📦 Agrupando linhas por equipmentId...');
    
    const groups = new Map<string, ExcelRow[]>();
    let skippedRows = 0;
    
    for (const row of rows) {
        const descPadronizada = row[COLUMNS.descricao_padronizada];
        
        if (!isValidValue(descPadronizada)) {
            skippedRows++;
            continue;
        }
        
        const equipmentId = buildEquipmentId(String(descPadronizada));
        
        if (!equipmentId) {
            skippedRows++;
            continue;
        }
        
        if (!groups.has(equipmentId)) {
            groups.set(equipmentId, []);
        }
        
        groups.get(equipmentId)!.push(row);
    }
    
    console.log(`   ✅ ${groups.size} equipamentos únicos encontrados`);
    if (skippedRows > 0) {
        console.log(`   ⚠️  ${skippedRows} linhas ignoradas (sem descrição padronizada válida)`);
    }
    
    return groups;
}

/**
 * Agrega métricas de um grupo de linhas
 */
function aggregateRows(
    equipmentId: string,
    rows: ExcelRow[],
    docIndex: number
): AggregatedDocument | null {
    // Pegar primeira linha como referência para metadados
    const refRow = rows[0];
    
    // Title: usar Descrição Padronizada original (com acentos, capitalização)
    const title = String(refRow[COLUMNS.descricao_padronizada] || '').trim();
    if (!title) return null;
    
    // rawText: usar apenas Descrição Padronizada (sem duplicação)
    const rawText = title;
    
    // text: normalizado para busca
    const text = normalizeEquipment(rawText);
    
    // === AGREGAÇÃO NUMÉRICA ===
    
    // Valor Unitário
    const valoresUnitarios: number[] = [];
    for (const row of rows) {
        const val = parseBrazilianNumber(row[COLUMNS.valor_unitario]);
        if (val !== null && val > 0) {
            valoresUnitarios.push(val);
        }
    }
    
    // Vida Útil (meses)
    const vidasUteis: number[] = [];
    for (const row of rows) {
        const val = parseBrazilianNumber(row[COLUMNS.vida_util_meses]);
        if (val !== null && val > 0) {
            vidasUteis.push(val);
        }
    }
    
    // Manutenção (%)
    const manutencoes: number[] = [];
    for (const row of rows) {
        const val = parseBrazilianNumber(row[COLUMNS.manutencao]);
        if (val !== null && val >= 0) {
            manutencoes.push(normalizeMaintenancePercent(val));
        }
    }
    
    // Calcular métricas
    const metrics: AggregatedDocument['metrics'] = {};
    
    if (valoresUnitarios.length > 0) {
        const stats = calculateMetrics(valoresUnitarios);
        metrics.valorUnitario = {
            ...stats,
            display: selectDisplayValue(stats)
        };
    }
    
    if (vidasUteis.length > 0) {
        const stats = calculateMetrics(vidasUteis);
        metrics.vidaUtilMeses = {
            ...stats,
            display: selectDisplayValue(stats)
        };
    }
    
    if (manutencoes.length > 0) {
        const stats = calculateMetrics(manutencoes);
        metrics.manutencao = {
            ...stats,
            display: selectDisplayValue(stats),
            unit: 'fraction' // Armazenado como fração (0..1)
        };
    }
    
    // === PROVENANCE/RASTREABILIDADE ===
    
    const fornecedores = new Set<string>();
    const bids = new Set<string>();
    const marcas = new Set<string>();
    
    for (const row of rows) {
        const fornecedor = row[COLUMNS.fornecedor];
        if (isValidValue(fornecedor)) {
            fornecedores.add(String(fornecedor).trim());
        }
        
        const bid = row[COLUMNS.fonte];
        if (isValidValue(bid)) {
            bids.add(String(bid).trim());
        }
        
        const marca = row[COLUMNS.marca];
        if (isValidValue(marca)) {
            marcas.add(String(marca).trim());
        }
    }
    
    // Semantic text enriquecido
    const semanticParts: string[] = [title];
    
    if (fornecedores.size > 0) {
        semanticParts.push(`Fornecedor: ${Array.from(fornecedores).join(', ')}`);
    }
    
    if (marcas.size > 0) {
        semanticParts.push(`Marca: ${Array.from(marcas).join(', ')}`);
    }
    
    if (bids.size > 0) {
        semanticParts.push(`Fonte: ${Array.from(bids).join(', ')}`);
    }
    
    const semanticText = semanticParts.join(' | ');

    // Taxonomia (persistida no doc): não reclassificar em runtime
    const docCategory = detectCategory(title);
    const docType = detectDocType(title);
    
    // Criar documento agregado
    const doc: AggregatedDocument = {
        id: `DOC_${String(docIndex).padStart(5, '0')}`,
        equipmentId,
        title,
        text,
        rawText,
        semanticText,
        docCategory,
        docType,
        metrics,
        sources: {
            fornecedores: Array.from(fornecedores),
            bids: Array.from(bids),
            marcas: Array.from(marcas),
            nLinhas: rows.length
        }
    };
    
    return doc;
}

/**
 * Constrói corpus agregado
 */
function buildAggregatedCorpus(groups: Map<string, ExcelRow[]>): AggregatedDocument[] {
    console.log('\n🔨 Construindo corpus agregado...');
    
    const corpus: AggregatedDocument[] = [];
    let docIndex = 0;
    
    for (const [equipmentId, rows] of groups.entries()) {
        const doc = aggregateRows(equipmentId, rows, docIndex);
        
        if (doc) {
            corpus.push(doc);
            docIndex++;
        }
    }
    
    console.log(`   ✅ ${corpus.length} documentos agregados criados`);
    
    return corpus;
}

/**
 * Escreve dataset no arquivo JSON
 */
function writeDataset(
    corpus: AggregatedDocument[],
    originalRows: number,
    outputPath: string
): void {
    console.log(`\n💾 Gravando dataset em: ${outputPath}`);
    
    const dataset: DatasetOutput = {
        metadata: {
            description: 'Dataset agregado com métricas consolidadas por equipamento',
            source: 'Excel file (dados_internos.xlsx)',
            exportedAt: new Date().toISOString(),
            aggregationMethod: 'numeric_aggregation',
            displayValueMethod: 'median', // Usar mediana como valor display
            originalRows,
            uniqueEquipments: corpus.length,
            version: '4.0.0'
        },
        corpus
    };
    
    // Criar backup do arquivo anterior
    if (fs.existsSync(outputPath)) {
        const backupPath = `${outputPath}.bak`;
        fs.copyFileSync(outputPath, backupPath);
        console.log(`   📋 Backup criado: ${backupPath}`);
    }
    
    const json = JSON.stringify(dataset, null, 2);
    fs.writeFileSync(outputPath, json, 'utf-8');
    
    const sizeKB = (json.length / 1024).toFixed(2);
    console.log(`   ✅ ${sizeKB} KB gravados`);
}

/**
 * Gera relatório de validação
 */
function generateValidationReport(corpus: AggregatedDocument[]): void {
    console.log('\n============================================================');
    console.log('📊 RELATÓRIO DE VALIDAÇÃO');
    console.log('============================================================');
    
    // 1. Contar duplicados por equipmentId (deve ser 0)
    const equipmentIds = corpus.map(d => d.equipmentId);
    const uniqueIds = new Set(equipmentIds);
    const duplicates = equipmentIds.length - uniqueIds.size;
    
    console.log(`\n✅ Duplicados por equipmentId: ${duplicates} (esperado: 0)`);
    
    // 2. Estatísticas gerais
    const docsComValor = corpus.filter(d => d.metrics.valorUnitario).length;
    const docsComVida = corpus.filter(d => d.metrics.vidaUtilMeses).length;
    const docsComManut = corpus.filter(d => d.metrics.manutencao).length;
    
    console.log(`\n📈 Cobertura de métricas:`);
    console.log(`   - Valor Unitário: ${docsComValor}/${corpus.length} (${(docsComValor/corpus.length*100).toFixed(1)}%)`);
    console.log(`   - Vida Útil: ${docsComVida}/${corpus.length} (${(docsComVida/corpus.length*100).toFixed(1)}%)`);
    console.log(`   - Manutenção: ${docsComManut}/${corpus.length} (${(docsComManut/corpus.length*100).toFixed(1)}%)`);
    
    // 3. Exemplos de agregação (incluindo "enceradeira 510 mm")
    console.log(`\n📋 EXEMPLOS DE AGREGAÇÃO (5 itens):`);
    console.log('============================================================');
    
    const examples = [
        'enceradeira 510 mm',
        'enceradeira 350 mm',
        'lavadora de piso automatica 20l',
        'aspirador de po e liquido',
        'carrinho funcional completo'
    ];
    
    for (const exampleId of examples) {
        const doc = corpus.find(d => d.equipmentId === exampleId);
        
        if (!doc) {
            console.log(`\n⚠️  "${exampleId}" não encontrado no corpus`);
            continue;
        }
        
        console.log(`\n📦 ${doc.title}`);
        console.log(`   equipmentId: ${doc.equipmentId}`);
        console.log(`   Amostras: ${doc.sources.nLinhas} linhas`);
        
        if (doc.metrics.valorUnitario) {
            const m = doc.metrics.valorUnitario;
            console.log(`   Valor Unitário:`);
            console.log(`     - Display: R$ ${m.display.toFixed(2)} (mediana)`);
            console.log(`     - Média: R$ ${m.mean.toFixed(2)}`);
            console.log(`     - Min/Max: R$ ${m.min.toFixed(2)} / R$ ${m.max.toFixed(2)}`);
            console.log(`     - N: ${m.n}`);
        }
        
        if (doc.metrics.vidaUtilMeses) {
            const m = doc.metrics.vidaUtilMeses;
            console.log(`   Vida Útil (meses):`);
            console.log(`     - Display: ${m.display} (mediana)`);
            console.log(`     - Média: ${m.mean.toFixed(1)}`);
            console.log(`     - Min/Max: ${m.min} / ${m.max}`);
            console.log(`     - N: ${m.n}`);
        }
        
        if (doc.metrics.manutencao) {
            const m = doc.metrics.manutencao;
            console.log(`   Manutenção:`);
            console.log(`     - Display: ${(m.display * 100).toFixed(2)}% (mediana, fração: ${m.display.toFixed(4)})`);
            console.log(`     - Média: ${(m.mean * 100).toFixed(2)}%`);
            console.log(`     - Min/Max: ${(m.min * 100).toFixed(2)}% / ${(m.max * 100).toFixed(2)}%`);
            console.log(`     - N: ${m.n}`);
        }
        
        console.log(`   Fornecedores: ${doc.sources.fornecedores.join(', ')}`);
        console.log(`   Bids: ${doc.sources.bids.join(', ')}`);
    }
    
    console.log('\n============================================================');
}

// =============================================================================
// Main
// =============================================================================

async function main() {
    console.log('============================================================');
    console.log('📊 Dataset Aggregator - Versão 4.0');
    console.log('============================================================\n');
    
    try {
        // 1. Ler Excel
        const rows = readExcelFile(EXCEL_PATH, SHEET_NAME);
        
        if (rows.length === 0) {
            throw new Error('Nenhuma linha encontrada no arquivo Excel');
        }
        
        // 2. Agrupar por equipmentId
        const groups = aggregateByEquipmentId(rows);
        
        if (groups.size === 0) {
            throw new Error('Nenhum equipamento válido encontrado para agregar');
        }
        
        // 3. Agregar métricas
        const corpus = buildAggregatedCorpus(groups);
        
        if (corpus.length === 0) {
            throw new Error('Nenhum documento agregado foi gerado');
        }
        
        // 4. Escrever dataset
        writeDataset(corpus, rows.length, OUTPUT_PATH);
        
        // 5. Gerar relatório de validação
        generateValidationReport(corpus);
        
        console.log('\n============================================================');
        console.log('✅ Agregação concluída com sucesso!');
        console.log('============================================================');
        console.log(`📁 Arquivo gerado: ${OUTPUT_PATH}`);
        console.log(`📊 ${rows.length} linhas → ${corpus.length} equipamentos únicos`);
        console.log('============================================================\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Erro na agregação:');
        console.error(error);
        process.exit(1);
    }
}

// Executar
main();
