/**
 * Text Normalization Utilities
 * Equivalent to Python's normalize_equip() function
 */

/**
 * Removes accents from text
 */
function removeAccents(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes equipment text for search
 * This is equivalent to Python's normalize_equip() function
 * 
 * Steps:
 * 1. Lowercase
 * 2. Remove accents
 * 3. Remove special characters (keep only letters, numbers, spaces)
 * 4. Replace multiple spaces with single space
 * 5. Trim
 * 
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeEquipment(text: string): string {
    if (!text) return '';
    
    return text
        .toLowerCase()                           // lowercase
        .normalize('NFD')                        // decompose accents
        .replace(/[\u0300-\u036f]/g, '')        // remove accent marks
        .replace(/[^a-z0-9\s]/g, ' ')           // remove special chars (keep letters, numbers, spaces)
        .replace(/\s+/g, ' ')                    // collapse multiple spaces
        .trim();                                 // trim edges
}

/**
 * normalizeText() único e reutilizável.
 *
 * Regras obrigatórias:
 * - lowercase
 * - remover acentos (NFD + remove diacríticos)
 * - remover pontuação (manter números e letras)
 * - colapsar espaços
 */
export function normalizeText(text: string): string {
    return normalizeEquipment(text);
}

/**
 * Sanitizes text (less aggressive than normalize)
 * Removes special characters but preserves more structure
 */
export function sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Converts Brazilian number format to float
 * Examples: "1.234,56" -> 1234.56, "1234,56" -> 1234.56
 */
export function parseBrazilianNumber(value: string | number): number | null {
    if (typeof value === 'number') return value;
    if (!value) return null;
    
    const str = String(value).trim();
    if (!str) return null;
    
    // Remove thousands separator (.) and replace decimal comma (,) with dot
    const normalized = str
        .replace(/\./g, '')     // remove thousands separator
        .replace(/,/g, '.');    // replace decimal comma with dot
    
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Extracts consonant signature from text (for fuzzy matching)
 */
export function getConsonantKey(text: string): string {
    return normalizeEquipment(text)
        .replace(/[aeiou\s]/g, '')
        .substring(0, 10);
}
