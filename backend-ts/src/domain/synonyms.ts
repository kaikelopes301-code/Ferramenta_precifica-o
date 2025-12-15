/**
 * 🔴 DEPRECATED – CÓDIGO LEGADO
 * 
 * Este módulo está obsoleto e foi substituído por:
 * - Busca semântica (SemanticSearchService) que naturalmente captura sinônimos via embeddings
 * - TsHybridEngine com busca híbrida BM25+Semantic
 * 
 * RAZÃO: Embeddings capturam relações semânticas sem necessidade de dicionário manual
 * STATUS: Preservado para referência histórica, não usar em código novo
 * DATA: Janeiro 2025
 * 
 * ============================================================================
 * 
 * Expanded Domain Synonyms for Equipment Search
 * 
 * Purpose: Improve recall by expanding queries with domain-specific synonyms
 * 
 * Usage:
 * - Query "mop" → expands to ["mop", "esfregão", "rodo úmido", "vassoura úmida"]
 * - Query "lavadora" → expands to ["lavadora", "máquina lavar", "lava piso"]
 * 
 * Maintenance:
 * - Add new synonyms as you identify common search patterns
 * - Validate with real user queries from search history
 */

export const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // === CORE CLEANING EQUIPMENT ===

  // Mops and floor cleaning
  "mop": ["mop", "esfregão", "rodo úmido", "vassoura úmida", "esfregona"],
  "esfregao": ["esfregão", "mop", "rodo úmido"],
  "rodo": ["rodo", "rodo seco", "rodo úmido", "mop"],

  // Floor scrubbers and washers
  "lavadora": ["lavadora", "máquina lavar", "lava piso", "lava chão", "lavadora piso"],
  "maquina lavar": ["máquina lavar", "lavadora", "lava piso"],
  "enceradeira": ["enceradeira", "politriz", "polidora"],

  // Vacuums
  "aspirador": ["aspirador", "aspirador de pó", "vácuo", "vacuum", "aspira pó"],
  "vacuum": ["vacuum", "aspirador", "vácuo"],
  "soprador": ["soprador", "sopradora", "blower"],

  // Pressure washers
  "lavadora pressao": ["lavadora pressão", "hidro lavadora", "jato pressão", "lavadora alta pressão"],
  "hidrolavadora": ["hidro lavadora", "lavadora pressão", "jato pressão"],

  // === CONTAINERS AND STORAGE ===

  "balde": ["balde", "bacia", "recipiente", "cuba"],
  "bacia": ["bacia", "balde", "recipiente"],
  "cesto": ["cesto", "lixeira", "cesta"],
  "lixeira": ["lixeira", "cesto lixo", "recipiente lixo"],

  // === CARTS AND MOBILE EQUIPMENT ===


  // === COMMON ATTRIBUTES ===

  "litro": ["litro", "l", "litros"],
  "galao": ["galão", "gal", "galões"],
  "watts": ["watts", "w", "watt"],
  "volts": ["volts", "v", "volt", "voltagem"],
  "bivolt": ["bivolt", "110 220", "110v 220v"],

  // === MATERIALS ===

  "piassava": ["piaçava", "piassava", "palha"],
  "nylon": ["nylon", "náilon", "nailon"],
  "plastico": ["plástico", "plástica", "plastic"],
  "inox": ["inox", "aço inox", "aço inoxidável"],

  // === COMMON MODIFIERS ===

  "industrial": ["industrial", "profissional", "comercial"],
  "profissional": ["profissional", "industrial", "comercial"],
  "domestico": ["doméstico", "residencial", "casa"],
  "hospitalar": ["hospitalar", "hospital", "médico"],
};

/**
 * Reverse map: term → all possible expansions
 * Built from DOMAIN_SYNONYMS
 */
export function getSynonymsForTerm(term: string): string[] {
  const normalized = term.toLowerCase().trim();

  // Direct lookup
  if (DOMAIN_SYNONYMS[normalized]) {
    return [...DOMAIN_SYNONYMS[normalized]];
  }

  // Reverse lookup (if term appears in any synonym list)
  for (const [key, synonyms] of Object.entries(DOMAIN_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return [...DOMAIN_SYNONYMS[key]!];
    }
  }

  // No synonyms found
  return [normalized];
}

/**
 * Expand a full query by replacing each token with its synonyms
 * Example: "mop industrial" → ["mop industrial", "esfregão industrial", "rodo úmido industrial"]
 */
export function expandQueryWithSynonyms(query: string, maxExpansions: number = 5): string[] {
  const tokens = query.toLowerCase().split(/\s+/);
  const expansions: Set<string> = new Set([query.toLowerCase()]);

  // For each token, try to expand with synonyms
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue; // Skip empty tokens

    const synonyms = getSynonymsForTerm(token);

    if (synonyms.length > 1) {
      // Replace this token with each synonym
      for (const syn of synonyms) {
        if (syn === token) continue; // Skip original

        const newTokens = [...tokens];
        newTokens[i] = syn;
        expansions.add(newTokens.join(' '));

        if (expansions.size >= maxExpansions) break;
      }
    }

    if (expansions.size >= maxExpansions) break;
  }

  return Array.from(expansions).slice(0, maxExpansions);
}
