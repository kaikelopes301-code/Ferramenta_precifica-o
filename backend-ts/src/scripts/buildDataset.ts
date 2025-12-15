#!/usr/bin/env node
/**
 * Dataset Builder for TypeScript Backend - Version 3.0
 * 
 * This script reads the Excel file and generates dataset_ts.json with:
 * - Normalized text for BM25 lexical search
 * - Raw text for display
 * - Semantic text for embeddings (NEW!)
 * - Rich metadata (supplier, brand, price, etc.)
 * 
 * Usage:
 *   npm run build-dataset
 *   OR
 *   node dist/scripts/buildDataset.js
 * 
 * Output Format:
 * {
 *   "metadata": { ... },
 *   "corpus": [
 *     {
 *       "id": "DOC_00001",
 *       "groupId": "lavadora piso automatica 20l",
 *       "text": "lavadora piso automatica 20l",            // For BM25
 *       "rawText": "Lavadora de Piso Automática 20L", // For display
 *       "semanticText": "Lavadora de Piso Automática 20L | Marca: Karcher | Fornecedor: XYZ",
 *       "supplier": "XYZ",
 *       "brand": "Karcher",
 *       "price": 4500.00,
 *       "lifespanMonths": 60,
 *       "maintenancePercent": 5
 *     }
 *   ]
 * }
 */

import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeEquipment, parseBrazilianNumber } from '../utils/textNormalization.js';
import { detectCategory, detectDocType, type DocCategory, type DocType } from '../search/semantic/taxonomy.js';

// ============================================================================
// Configuration
// ============================================================================

// Find the root directory (where data/ folder is located)
const findRootDir = (): string => {
    let currentDir = process.cwd();
    
    // If we're in backend-ts, go up one level
    if (currentDir.endsWith('backend-ts')) {
        return path.resolve(currentDir, '..');
    }
    
    // Otherwise, assume we're already at root
    return currentDir;
};

const ROOT_DIR = findRootDir();
const EXCEL_PATH = path.join(ROOT_DIR, 'data', 'dados_internos.xlsx');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'dataset_ts.json');
const SHEET_NAME = 'dados';

// Column names in Excel (as they appear in the file)
// TODO: Revisar nomes das colunas para garantir que correspondem exatamente à planilha atual.
// CRÍTICO: Vida Útil e Manutenção estão retornando N/A nos testes - verificar se os nomes das colunas estão corretos.
const COLUMNS = {
    fonte: 'Bid ou Fonte',
    fornecedor: 'Fornecedor',
    marca: 'marca',  // May not exist in current Excel
    descricao: 'Descrição',
    descricao_saneada: 'Descrição Saneada',
    descricao_padronizada: 'Descrição Padronizada',
    // TODO: Confirmar se esta coluna existe na planilha Excel atual.
    // Caminho: planilha "Valor Unitário" -> COLUMNS.valor_unitario -> doc.price
    valor_unitario: 'Valor Unitário',
    // ✅ CORRIGIDO: Nome exato da coluna no Excel (com acento em 'Útil')
    vida_util_meses: 'Vida Útil (meses)',
    // ✅ CORRIGIDO: Nome exato da coluna no Excel (com acento em 'Manutenção')
    manutencao: 'Manutenção (%)'
};

// Target columns for text building (in order of preference)
// CORREÇÃO: Usar APENAS 'Descrição Padronizada' para evitar duplicação de texto.
// Antes: concatenava 3 colunas → "vassoura plaçava vassoura placava VASSOURA PLAÇAVA"
// Agora: usa apenas 1 coluna → "VASSOURA PLAÇAVA"
const TEXT_COLUMNS = [
    'Descrição Padronizada'
    // Removido: 'Descrição Saneada' e 'Descrição' para eliminar duplicação
];

// ============================================================================
// Types
// ============================================================================

interface ExcelRow {
    [key: string]: any;
}

interface CorpusDocument {
    id: string;
    groupId: string;
    text: string;                    // Normalized text for BM25 search (kept for backward compatibility)
    rawText: string;                 // Original text for display
    semanticText: string;            // Rich text for embeddings (NEW!)
    docCategory?: DocCategory;
    docType?: DocType;
    supplier?: string;
    brand?: string;
    price?: number;
    lifespanMonths?: number;
    maintenancePercent?: number;
}

interface DatasetOutput {
    metadata: {
        description: string;
        source: string;
        exportedAt: string;
        corpusHash: string;
        originalRows: number;
        uniqueDocuments: number;
        version: string;
        features: string[];
    };
    corpus: CorpusDocument[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a value is valid (not null, undefined, or empty string)
 */
function isValidValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (typeof value === 'number' && isNaN(value)) return false;
    return true;
}

/**
 * Builds semantic text for embeddings
 * Combines relevant fields in a structured way for better semantic understanding
 * 
 * Format: "Descrição | Marca: X | Fornecedor: Y | Categoria: Z"
 * 
 * TODO: Revisar se buildSemanticText() contribui para duplicação de texto.
 * Esta função pega descrição de múltiplas fontes (padronizada, saneada, original).
 * Verificar se:
 * 1) rawText (usado para BM25/Fuzzy) contém o mesmo texto que semanticText
 * 2) groupDescription (usado para display na API) é derivado de rawText ou semanticText
 * 3) Se a duplicação vista na API é um problema de display (UI) ou de indexação (busca)
 */
function buildSemanticText(row: ExcelRow): string {
    const parts: string[] = [];
    
    // 1. Main description (try all variants)
    // TODO: Este fallback pode causar duplicação se rawText já usou essas colunas.
    // Considerar usar apenas UMA fonte de descrição para evitar redundância.
    const desc = row[COLUMNS.descricao_padronizada] || 
                 row[COLUMNS.descricao_saneada] || 
                 row[COLUMNS.descricao];
    if (isValidValue(desc)) {
        parts.push(String(desc).trim());
    }
    
    // 2. Brand (if available)
    const brand = row[COLUMNS.marca];
    if (isValidValue(brand)) {
        parts.push(`Marca: ${String(brand).trim()}`);
    }
    
    // 3. Supplier (if available)
    const supplier = row[COLUMNS.fornecedor];
    if (isValidValue(supplier)) {
        parts.push(`Fornecedor: ${String(supplier).trim()}`);
    }
    
    // 4. Source/Category (if available)
    const source = row[COLUMNS.fonte];
    if (isValidValue(source)) {
        parts.push(`Fonte: ${String(source).trim()}`);
    }
    
    return parts.join(' | ');
}

/**
 * Computes a simple hash for corpus identification
 */
function computeCorpusHash(rows: number, docs: number): string {
    const timestamp = Date.now();
    const hash = `${rows}_${docs}_${timestamp}`.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    return Math.abs(hash).toString(16).substring(0, 16);
}

/**
 * Reads Excel file and returns rows
 */
function readExcelFile(filePath: string, sheetName: string): ExcelRow[] {
    console.log(`📖 Reading Excel file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`Excel file not found: ${filePath}`);
    }
    
    const workbook = XLSX.readFile(filePath);
    
    // Check if sheet exists
    if (!workbook.SheetNames.includes(sheetName)) {
        console.log(`⚠️  Sheet "${sheetName}" not found. Available sheets:`, workbook.SheetNames);
        // Try first sheet as fallback
        const firstSheet = workbook.SheetNames[0];
        console.log(`   Using first sheet: "${firstSheet}"`);
        const worksheet = workbook.Sheets[firstSheet];
        return XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
    
    // DEBUG: Listar todas as colunas disponíveis no Excel
    if (rows.length > 0) {
        console.log('\n📋 COLUNAS DISPONÍVEIS NO EXCEL:');
        Object.keys(rows[0]).forEach((col, i) => {
            const marker = col.toLowerCase().includes('vida') || col.toLowerCase().includes('manut') ? ' ⭐' : '';
            console.log(`   ${String(i+1).padStart(2)}. "${col}"${marker}`);
        });
        console.log('');
    }
    
    console.log(`   ✅ Read ${rows.length} rows from sheet "${sheetName}"`);
    return rows;
}

/**
 * Builds corpus documents from Excel rows
 */
function buildCorpus(rows: ExcelRow[]): CorpusDocument[] {
    console.log('\n🔨 Building corpus documents...');
    
    // Group by descricao_padronizada
    const groups = new Map<string, ExcelRow[]>();
    
    for (const row of rows) {
        const groupKey = row[COLUMNS.descricao_padronizada];
        if (!isValidValue(groupKey)) continue;
        
        const groupId = String(groupKey).trim().toLowerCase();
        if (!groups.has(groupId)) {
            groups.set(groupId, []);
        }
        groups.get(groupId)!.push(row);
    }
    
    console.log(`   📦 Found ${groups.size} unique groups`);
    
    // Create documents
    const corpus: CorpusDocument[] = [];
    let docIndex = 0;
    
    for (const [groupId, groupRows] of groups.entries()) {
        // Use first row as representative
        const row = groupRows[0];
        
        // Build raw text from target columns
        // TODO: CRÍTICO - Revisar lógica de composição do rawText.
        // PROBLEMA OBSERVADO: descrições aparecem duplicadas nos resultados da API.
        // Exemplo: "lavadora de piso tripulada - lavadora de piso tripulada lavadora de piso alfamat brava..."
        // 
        // Possíveis causas:
        // 1) TEXT_COLUMNS contém colunas com conteúdo parcialmente duplicado:
        //    - 'Descrição Padronizada', 'Descrição Saneada', 'Descrição' podem ter texto similar/redundante
        // 2) rawParts.join(' ') concatena textos que já contêm uns aos outros
        // 3) groupId (usado como groupDescription na API) pode ser duplicado de rawText
        //
        // Sugestões de correção (para fase de correção, não agora):
        // - Usar apenas UMA coluna prioritária para rawText (ex: só 'Descrição Padronizada')
        // - OU deduplicar palavras/frases ao concatenar
        // - OU criar campo separado 'displayName' vs 'searchText'
        const rawParts: string[] = [];
        for (const col of TEXT_COLUMNS) {
            const val = row[col];
            if (isValidValue(val)) {
                rawParts.push(String(val).trim());
            }
        }
        
        const rawText = rawParts.length > 0 
            ? rawParts.join(' ') 
            : String(row[COLUMNS.descricao] || '');
        
        // Normalize text for search (BM25)
        const textNormalized = normalizeEquipment(rawText);
        
        // Build semantic text for embeddings
        const semanticText = buildSemanticText(row);
        
        // Skip empty documents
        if (!textNormalized.trim() || !semanticText.trim()) {
            continue;
        }
        
        // Create document
        const doc: CorpusDocument = {
            id: `DOC_${String(docIndex).padStart(5, '0')}`,
            groupId: groupId,
            text: textNormalized,
            rawText: rawText,
            semanticText: semanticText,
            docCategory: detectCategory(rawText),
            docType: detectDocType(rawText)
        };
        
        // Add optional fields
        const supplier = row[COLUMNS.fornecedor];
        if (isValidValue(supplier)) {
            doc.supplier = String(supplier).trim();
        }
        
        const brand = row[COLUMNS.marca];
        if (isValidValue(brand)) {
            doc.brand = String(brand).trim();
        }
        
        // TODO: Confirmar que row[COLUMNS.valor_unitario] está lendo a coluna correta da planilha.
        // Adicionar log temporário se price === null para debugar linhas sem valor unitário.
        const price = parseBrazilianNumber(row[COLUMNS.valor_unitario]);
        if (price !== null) {
            doc.price = price;
        }
        
        // DEBUG: Log para identificar por que vida útil está null
        const vidaUtilRaw = row[COLUMNS.vida_util_meses];
        const lifespan = parseBrazilianNumber(vidaUtilRaw);
        if (docIndex < 3) { // Log apenas primeiras 3 linhas
            console.log(`[DEBUG] Linha ${docIndex}: vida_util_raw="${vidaUtilRaw}" → parsed=${lifespan}`);
        }
        if (lifespan !== null) {
            doc.lifespanMonths = lifespan;
        }
        
        // DEBUG: Log para identificar por que manutenção está null
        const manutencaoRaw = row[COLUMNS.manutencao];
        const maintenance = parseBrazilianNumber(manutencaoRaw);
        if (docIndex < 3) { // Log apenas primeiras 3 linhas
            console.log(`[DEBUG] Linha ${docIndex}: manutencao_raw="${manutencaoRaw}" → parsed=${maintenance}`);
        }
        if (maintenance !== null) {
            doc.maintenancePercent = maintenance;
        }
        
        corpus.push(doc);
        docIndex++;
    }
    
    console.log(`   ✅ Built ${corpus.length} documents`);
    return corpus;
}

/**
 * Writes dataset to JSON file
 */
function writeDataset(corpus: CorpusDocument[], originalRows: number, outputPath: string): void {
    console.log(`\n💾 Writing dataset to: ${outputPath}`);
    
    const dataset: DatasetOutput = {
        metadata: {
            description: 'Dataset export for TypeScript search engine with semantic text support',
            source: 'Excel file (dados_internos.xlsx)',
            exportedAt: new Date().toISOString(),
            corpusHash: computeCorpusHash(originalRows, corpus.length),
            originalRows: originalRows,
            uniqueDocuments: corpus.length,
            version: '3.0.0',
            features: ['semantic_text', 'normalized_text', 'rich_metadata']
        },
        corpus: corpus
    };
    
    const json = JSON.stringify(dataset, null, 2);
    fs.writeFileSync(outputPath, json, 'utf-8');
    
    const sizeKB = (json.length / 1024).toFixed(2);
    console.log(`   ✅ Written ${sizeKB} KB`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('============================================================');
    console.log('📊 Dataset Builder for TypeScript Backend');
    console.log('============================================================\n');
    
    try {
        // 1. Read Excel
        const rows = readExcelFile(EXCEL_PATH, SHEET_NAME);
        
        if (rows.length === 0) {
            throw new Error('No rows found in Excel file');
        }
        
        // 2. Build corpus
        const corpus = buildCorpus(rows);
        
        if (corpus.length === 0) {
            throw new Error('No valid documents generated from Excel data');
        }
        
        // 3. Write dataset
        writeDataset(corpus, rows.length, OUTPUT_PATH);
        
        console.log('\n============================================================');
        console.log('✅ Dataset export complete!');
        console.log('============================================================');
        console.log(`📊 Statistics:`);
        console.log(`   - Original rows: ${rows.length}`);
        console.log(`   - Unique documents: ${corpus.length}`);
        console.log(`   - Output: ${OUTPUT_PATH}`);
        console.log('============================================================');
        console.log('\n📝 Sample Document (first item):');
        if (corpus.length > 0) {
            console.log(JSON.stringify(corpus[0], null, 2));
        }
        console.log('============================================================\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error building dataset:');
        console.error(error);
        process.exit(1);
    }
}

// Run if executed directly
main();

export { buildCorpus, readExcelFile, normalizeEquipment };
