/**
 * Currency Parsing Utilities
 * 
 * Robust parsing of Brazilian Real (BRL) currency values.
 * Handles multiple formats and edge cases safely.
 * 
 * @version 1.0.0
 */

/**
 * Parse Brazilian currency string to number
 * 
 * Supported formats:
 * - "R$ 1.500,00" (standard BRL with symbol and separators)
 * - "R$1500,00" (no space after symbol)
 * - "1.500,00" (no symbol)
 * - "1500.00" (US format)
 * - "1500" (integer only)
 * - Numbers: passed through if valid
 * 
 * Edge cases:
 * - null/undefined → 0
 * - Empty string → 0
 * - Invalid format → 0 (with warning)
 * 
 * @param value - Value to parse (string, number, or null/undefined)
 * @param context - Optional context for logging (e.g., product ID)
 * @returns Parsed number (always >= 0)
 */
export function parseBRLCurrency(value: unknown, context?: string): number {
    // Handle null/undefined
    if (value === null || value === undefined) {
        return 0;
    }

    // Handle numbers directly
    if (typeof value === 'number') {
        if (isNaN(value) || value < 0) {
            console.warn(`[Currency] Invalid number value: ${value}`, context ? `(context: ${context})` : '');
            return 0;
        }
        return value;
    }

    // Handle non-string types
    if (typeof value !== 'string') {
        console.warn(`[Currency] Unexpected type: ${typeof value}`, context ? `(context: ${context})` : '');
        return 0;
    }

    // Handle empty string
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === 'N/A' || trimmed === 'null') {
        return 0;
    }

    try {
        // Normalize BRL format to US format for parsing
        let normalized = trimmed;

        // Remove currency symbols and extra spaces
        normalized = normalized.replace(/R\$\s*/g, ''); // "R$ " or "R$"
        normalized = normalized.trim();

        // Detect format by checking for comma as decimal separator
        const hasCommaDecimal = /,\d{1,2}$/.test(normalized);

        if (hasCommaDecimal) {
            // BRL format: "1.500,00" → "1500.00"
            normalized = normalized
                .replace(/\./g, '')      // Remove thousand separators (dots)
                .replace(',', '.');       // Replace decimal separator (comma → dot)
        } else {
            // US format or integer: "1500.00" or "1500" → keep as is
            // Remove any thousand separators (commas in US format)
            normalized = normalized.replace(/,(?=\d{3})/g, '');
        }

        // Parse to float
        const parsed = parseFloat(normalized);

        // Validate result
        if (isNaN(parsed)) {
            console.warn(`[Currency] Failed to parse: "${value}"`, context ? `(context: ${context})` : '');
            return 0;
        }

        if (parsed < 0) {
            console.warn(`[Currency] Negative value parsed: ${parsed} from "${value}"`, context ? `(context: ${context})` : '');
            return 0;
        }

        return parsed;
    } catch (error) {
        console.error(`[Currency] Parse error for value "${value}":`, error, context ? `(context: ${context})` : '');
        return 0;
    }
}

/**
 * Format number to BRL currency string
 * 
 * @param value - Number to format
 * @returns Formatted string (e.g., "R$ 1.500,00")
 */
export function formatBRLCurrency(value: number): string {
    if (isNaN(value)) {
        return 'R$ 0,00';
    }

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

/**
 * Validate if a string is a valid BRL currency format
 * 
 * @param value - String to validate
 * @returns true if valid format
 */
export function isValidBRLFormat(value: string): boolean {
    const brlPattern = /^R\$?\s*\d{1,3}(\.\d{3})*(,\d{2})?$/;
    const usPattern = /^\d{1,3}(,\d{3})*(\.\d{2})?$/;
    const simplePattern = /^\d+(\.\d{2})?$/;

    return brlPattern.test(value.trim()) || 
           usPattern.test(value.trim()) || 
           simplePattern.test(value.trim());
}
