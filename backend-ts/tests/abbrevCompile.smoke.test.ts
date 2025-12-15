import { describe, expect, it } from 'vitest';
import { normalizeText } from '../src/utils/textNormalization.js';

// Nota: este teste NÃO lê o JSON gigante. Ele valida invariantes do normalizador.

describe('Abbrev compile - smoke', () => {
  it('normalizeText remove acentos e pontuação', () => {
    expect(normalizeText('móp')).toBe('mop');
    expect(normalizeText('  Det.  ')).toBe('det');
    expect(normalizeText('c/ rosca acme')).toBe('c rosca acme');
  });
});
