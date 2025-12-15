import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { normalizeText } from '../src/utils/textNormalization.js';

type CompiledAbbrev = {
  exactMap: Record<string, string>;
  tokenMap: Record<string, string>;
  expandMap: Record<string, string[]>;
};

type AmbiguousCase = {
  key: string;
  variants: string[];
};

type CompileReport = {
  sourcePath: string;
  outputPath: string;
  reportPath: string;
  compiledAt: string;
  metrics: {
    rawEntries: number;
    totalVariantsAfterSplit: number;
    uniqueNormalizedKeys: number;
    exactMapCount: number;
    tokenMapCount: number;
    expandMapCount: number;
    ambiguousDiscardedCount: number;
    buildTimeMs: number;
    compiledFileSizeBytes: number;
  };
  totals: {
    rawPairs: number;
    rawKeyVariants: number;
    skippedEmpty: number;
    skippedRules: number;
    ambiguousKeys: number;
    exactMap: number;
    tokenMap: number;
    expandMap: number;
  };
  topTokensMostUsed: Array<{ token: string; count: number }>;
  ambiguousCases: AmbiguousCase[];
};

const TOKEN_KEY_RE = /^[a-z0-9]{2,6}$/;

function pluralizeNaivePortuguese(word: string): string {
  if (!word) return word;
  // Regra simples e previsível (o pedido exige plural; segurança > NLP perfeito)
  return word.endsWith('s') ? word : `${word}s`;
}

function splitKeyVariants(rawKey: string): string[] {
  // No abreviaudit, o separador "|" aparece como lista de variantes.
  return rawKey
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
}

function looksLikePriceOrDecimalComma(text: string): boolean {
  // Regra obrigatória: NÃO capturar valores com padrão \d,\d (ex.: "7,5", "1,40", "1.234,56")
  if (/\d,\d/.test(text)) return true;
  // Mantemos também um guard simples para preço.
  if (/\bR\$\b/i.test(text)) return true;
  return false;
}

function parseEntityList(rawValue: string): string[] | null {
  if (!rawValue.includes(',')) return null;
  if (looksLikePriceOrDecimalComma(rawValue)) return null;

  // Regra obrigatória: lista só se houver ", " + letra (evita listas de números/medidas)
  // Usa Unicode property escape para letras.
  if (!/,\s+\p{L}/u.test(rawValue)) return null;

  const parts = rawValue
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const normalizedParts = parts
    .map(p => normalizeText(p))
    .map(p => p.trim())
    .filter(Boolean);

  // Precisa "parecer lista de entidades": pelo menos 2 itens distintos com letras.
  const unique = Array.from(new Set(normalizedParts));
  if (unique.length < 2) return null;

  const hasLettersCount = unique.filter(u => /[a-z]/.test(u)).length;
  if (hasLettersCount < 2) return null;

  return unique;
}

function safeReadJsonText(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

function tryParseJsonObject(text: string, sourcePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Formato inesperado: esperado um objeto JSON {"key": "value", ...}');
    }
    return parsed as Record<string, unknown>;
  } catch (err: any) {
    const message = err?.message ? String(err.message) : String(err);
    throw new Error(
      `Falha ao fazer parse do JSON em ${sourcePath}: ${message}. ` +
        `Sugestão: valide o arquivo (ex.: JSONLint) e confirme se não há vírgula sobrando/aspas inválidas.`
    );
  }
}

type Observation = {
  kind: 'token' | 'exact' | 'expand';
  // Para ambiguidade: single => "SINGLE:<value>", list => "LIST:a|b|c"
  signature: string;
  // Para "top tokens mais usados"
  tokenKey?: string;
};

function classify(rawValue: string, normalizedValue: string, keyNormalized: string): Observation {
  const listItems = parseEntityList(rawValue);
  if (listItems) {
    const signature = `LIST:${listItems.join('|')}`;
    return { kind: 'expand', signature };
  }

  // tokenMap: chave curta (2..6, alfanum)
  if (TOKEN_KEY_RE.test(keyNormalized)) {
    const signature = `SINGLE:${normalizedValue}`;
    return { kind: 'token', signature, tokenKey: keyNormalized };
  }

  return { kind: 'exact', signature: `SINGLE:${normalizedValue}` };
}

export async function compileAbbrev(params?: {
  sourcePath?: string;
  outputPath?: string;
  reportPath?: string;
}): Promise<{ compiled: CompiledAbbrev; report: CompileReport }> {
  const startMs = performance.now();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const sourcePath = params?.sourcePath ?? path.resolve(__dirname, '../../data/abbrev_audit.json');
  const outputPath = params?.outputPath ?? path.resolve(__dirname, '../data/abbrev.compiled.json');
  const reportPath = params?.reportPath ?? path.resolve(__dirname, '../data/abbrev_compile_report.json');

  const jsonText = await safeReadJsonText(sourcePath);
  const obj = tryParseJsonObject(jsonText, sourcePath);

  const rawPairs = Object.keys(obj).length;

  // 1) Coletar observações e detectar ambiguidade
  const observationsByKey = new Map<string, Set<string>>();
  const keyKinds = new Map<string, Set<Observation['kind']>>();
  // Contagem bruta de tokens (no arquivo fonte). O relatório final usa apenas tokens aceitos.
  const tokenUsageRaw = new Map<string, number>();
  const uniqueNormalizedKeys = new Set<string>();

  let rawKeyVariants = 0;
  let skippedEmpty = 0;

  for (const [rawKeyGroup, rawValUnknown] of Object.entries(obj)) {
    const rawValue = typeof rawValUnknown === 'string' ? rawValUnknown : String(rawValUnknown ?? '');

    const keyVariants = splitKeyVariants(String(rawKeyGroup));
    for (const rawKey of keyVariants) {
      rawKeyVariants++;

      const keyNormalized = normalizeText(rawKey);
      const normalizedValue = normalizeText(rawValue);

      if (!keyNormalized || !normalizedValue) {
        skippedEmpty++;
        continue;
      }

      uniqueNormalizedKeys.add(keyNormalized);

      const obs = classify(rawValue, normalizedValue, keyNormalized);
      const keyForAmbiguity = obs.kind === 'expand' ? pluralizeNaivePortuguese(keyNormalized) : keyNormalized;

      if (!observationsByKey.has(keyForAmbiguity)) observationsByKey.set(keyForAmbiguity, new Set());
      observationsByKey.get(keyForAmbiguity)!.add(obs.signature);

      if (!keyKinds.has(keyForAmbiguity)) keyKinds.set(keyForAmbiguity, new Set());
      keyKinds.get(keyForAmbiguity)!.add(obs.kind);

      if (obs.tokenKey) {
        tokenUsageRaw.set(obs.tokenKey, (tokenUsageRaw.get(obs.tokenKey) ?? 0) + 1);
      }
    }
  }

  const ambiguousCases: AmbiguousCase[] = [];
  const ambiguousKeySet = new Set<string>();

  for (const [key, signatures] of observationsByKey.entries()) {
    const kinds = keyKinds.get(key) ?? new Set();
    const isAmbiguous = signatures.size > 1 || kinds.size > 1;
    if (!isAmbiguous) continue;

    ambiguousKeySet.add(key);
    ambiguousCases.push({ key, variants: Array.from(signatures).slice(0, 50) });
  }

  // 2) Construir mapas finais aplicando as regras
  const exactMap: Record<string, string> = Object.create(null);
  const tokenMap: Record<string, string> = Object.create(null);
  const expandMap: Record<string, string[]> = Object.create(null);

  let skippedRules = 0;

  for (const [rawKeyGroup, rawValUnknown] of Object.entries(obj)) {
    const rawValue = typeof rawValUnknown === 'string' ? rawValUnknown : String(rawValUnknown ?? '');

    const keyVariants = splitKeyVariants(String(rawKeyGroup));
    for (const rawKey of keyVariants) {
      const keyNormalized = normalizeText(rawKey);
      const normalizedValue = normalizeText(rawValue);

      if (!keyNormalized || !normalizedValue) continue;

      const listItems = parseEntityList(rawValue);
      if (listItems) {
        const categoryKey = pluralizeNaivePortuguese(keyNormalized);
        if (ambiguousKeySet.has(categoryKey)) continue;

        const current = expandMap[categoryKey] ?? [];
        const merged = Array.from(new Set([...current, ...listItems]))
          .filter(Boolean)
          .slice(0, 12);

        expandMap[categoryKey] = merged;
        continue;
      }

      if (ambiguousKeySet.has(keyNormalized)) continue;

      // tokenMap
      if (TOKEN_KEY_RE.test(keyNormalized)) {
        // Regra: aceitar apenas chaves token e valores não vazios
        if (normalizedValue === keyNormalized) {
          skippedRules++;
          continue;
        }
        tokenMap[keyNormalized] = normalizedValue;
        continue;
      }

      // exactMap
      if (normalizedValue.length < 4) {
        skippedRules++;
        continue;
      }
      if (normalizedValue === keyNormalized) {
        skippedRules++;
        continue;
      }
      exactMap[keyNormalized] = normalizedValue;
    }
  }

  // 3) top tokens
  const topTokensMostUsed = Object.keys(tokenMap)
    .map(token => ({ token, count: tokenUsageRaw.get(token) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const compiled: CompiledAbbrev = { exactMap, tokenMap, expandMap };

  const report: CompileReport = {
    sourcePath,
    outputPath,
    reportPath,
    compiledAt: new Date().toISOString(),
    metrics: {
      rawEntries: 0,
      totalVariantsAfterSplit: 0,
      uniqueNormalizedKeys: 0,
      exactMapCount: 0,
      tokenMapCount: 0,
      expandMapCount: 0,
      ambiguousDiscardedCount: 0,
      buildTimeMs: 0,
      compiledFileSizeBytes: 0,
    },
    totals: {
      rawPairs,
      rawKeyVariants,
      skippedEmpty,
      skippedRules,
      ambiguousKeys: ambiguousKeySet.size,
      exactMap: Object.keys(exactMap).length,
      tokenMap: Object.keys(tokenMap).length,
      expandMap: Object.keys(expandMap).length,
    },
    topTokensMostUsed,
    ambiguousCases: ambiguousCases
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, 5000),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(compiled), 'utf8');

  const compiledStat = await fs.stat(outputPath);
  const endMs = performance.now();
  report.metrics = {
    rawEntries: rawPairs,
    totalVariantsAfterSplit: rawKeyVariants,
    uniqueNormalizedKeys: uniqueNormalizedKeys.size,
    exactMapCount: Object.keys(exactMap).length,
    tokenMapCount: Object.keys(tokenMap).length,
    expandMapCount: Object.keys(expandMap).length,
    ambiguousDiscardedCount: ambiguousKeySet.size,
    buildTimeMs: Math.round(endMs - startMs),
    compiledFileSizeBytes: compiledStat.size,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  return { compiled, report };
}

async function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has('--self-test')) {
    // Testes rápidos: normalização básica
    const a = normalizeText('móp');
    if (a !== 'mop') throw new Error(`Self-test falhou: normalizeText('móp') = "${a}" (esperado "mop")`);

    const b = normalizeText('  Det.  ');
    if (b !== 'det') throw new Error(`Self-test falhou: normalizeText('  Det.  ') = "${b}" (esperado "det")`);

    console.log('[compile-abbrev] ✅ self-test OK');
    return;
  }

  const { report } = await compileAbbrev();
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.log('[compile-abbrev] ✅ compiled', report.totals);
    console.log('[compile-abbrev] metrics', report.metrics);
    console.log('[compile-abbrev] report:', report.reportPath);
    console.log('[compile-abbrev] output:', report.outputPath);

    if (report.totals.ambiguousKeys > 0) {
      console.log(
        `[compile-abbrev] ⚠️  ambiguous keys descartadas: ${report.totals.ambiguousKeys} (detalhes no report)`
      );
    }
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = path.resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  await main();
}
