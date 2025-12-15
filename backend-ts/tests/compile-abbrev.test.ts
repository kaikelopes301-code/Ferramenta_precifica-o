import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileAbbrev } from '../scripts/compile-abbrev.js';
import { normalizeText } from '../src/utils/textNormalization.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abbrev-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('compile-abbrev', () => {
  it('normalizeText("móp") === "mop"', () => {
    expect(normalizeText('móp')).toBe('mop');
  });

  it('split por "|" gera múltiplas entradas no exactMap (com trim + normalize)', async () => {
    await withTempDir(async dir => {
      const sourcePath = path.join(dir, 'abbrev.json');
      const outputPath = path.join(dir, 'compiled.json');
      const reportPath = path.join(dir, 'report.json');

      const data = {
        '  Mop XL  |  móp grande  ': 'Esfregão elétrico',
      };

      await fs.writeFile(sourcePath, JSON.stringify(data), 'utf8');

      const { compiled } = await compileAbbrev({ sourcePath, outputPath, reportPath });

      expect(compiled.exactMap['mop xl']).toBe('esfregao eletrico');
      expect(compiled.exactMap['mop grande']).toBe('esfregao eletrico');
    });
  });

  it('"7,5 m" NÃO vira expandMap (decimal com vírgula deve bloquear)', async () => {
    await withTempDir(async dir => {
      const sourcePath = path.join(dir, 'abbrev.json');
      const outputPath = path.join(dir, 'compiled.json');
      const reportPath = path.join(dir, 'report.json');

      const data = {
        cabo: '7,5 m, 10 m',
      };

      await fs.writeFile(sourcePath, JSON.stringify(data), 'utf8');

      const { compiled } = await compileAbbrev({ sourcePath, outputPath, reportPath });

      expect(compiled.expandMap['cabos']).toBeUndefined();
      // Ainda pode cair em tokenMap ("cabo" é token válido)
      expect(compiled.tokenMap['cabo']).toBeTruthy();
    });
  });

  it('"mops" (plural) vira expandMap quando valor é lista real', async () => {
    await withTempDir(async dir => {
      const sourcePath = path.join(dir, 'abbrev.json');
      const outputPath = path.join(dir, 'compiled.json');
      const reportPath = path.join(dir, 'report.json');

      const data = {
        mop: 'mop po, mop agua',
      };

      await fs.writeFile(sourcePath, JSON.stringify(data), 'utf8');

      const { compiled } = await compileAbbrev({ sourcePath, outputPath, reportPath });

      expect(compiled.expandMap['mops']).toEqual(['mop po', 'mop agua']);
    });
  });
});
