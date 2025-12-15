import fs from 'node:fs/promises'
import path from 'node:path'
import type { AbbrevCompiled } from './searchTextPipeline.js'
import { logger } from '../infra/logging.js'

let cached: AbbrevCompiled | null = null
let loaded = false

export async function loadAbbrevCompiled(): Promise<AbbrevCompiled | null> {
  if (loaded) return cached

  loaded = true

  try {
    const filePath = path.join(process.cwd(), 'data', 'abbrev.compiled.json')
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as AbbrevCompiled

    if (!parsed || typeof parsed !== 'object') {
      cached = null
      return null
    }

    cached = {
      exactMap: parsed.exactMap ?? {},
      tokenMap: parsed.tokenMap ?? {},
      expandMap: parsed.expandMap ?? {},
    }

    logger.info(
      {
        exactMapCount: Object.keys(cached.exactMap).length,
        tokenMapCount: Object.keys(cached.tokenMap).length,
        expandMapCount: Object.keys(cached.expandMap).length,
      },
      '[abbrev] ✅ Loaded abbrev.compiled.json'
    )

    return cached
  } catch (err) {
    cached = null
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      '[abbrev] ⚠️ Could not load abbrev.compiled.json; continuing without abbrev rewrites'
    )
    return null
  }
}
