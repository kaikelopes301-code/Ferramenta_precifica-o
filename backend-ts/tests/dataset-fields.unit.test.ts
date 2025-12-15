import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

type NumericMetrics = {
  display: number
  unit?: 'fraction' | 'percent'
}

type DatasetDoc = {
  metrics?: {
    valorUnitario?: NumericMetrics
    vidaUtilMeses?: NumericMetrics
    manutencao?: NumericMetrics
  }
  price?: number
  lifespanMonths?: number
  maintenancePercent?: number
  valor_unitario?: number
  vida_util_meses?: number
  manutencao_percent?: number
}

type DatasetFile =
  | { metadata?: unknown; corpus: DatasetDoc[] }
  | DatasetDoc[]

function pickDatasetPath(): string {
  const localPath = path.join(process.cwd(), 'data', 'dataset_ts.json')
  const rootPath = path.join(process.cwd(), '..', 'data', 'dataset_ts.json')
  return existsSync(rootPath) ? rootPath : localPath
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function extractValorUnitario(doc: DatasetDoc): number | null {
  const fromMetrics = doc.metrics?.valorUnitario?.display
  if (isFiniteNumber(fromMetrics)) return fromMetrics

  const legacy = doc.price ?? doc.valor_unitario
  return isFiniteNumber(legacy) ? legacy : null
}

function extractVidaUtilMeses(doc: DatasetDoc): number | null {
  const fromMetrics = doc.metrics?.vidaUtilMeses?.display
  if (isFiniteNumber(fromMetrics)) return fromMetrics

  const legacy = doc.lifespanMonths ?? doc.vida_util_meses
  return isFiniteNumber(legacy) ? legacy : null
}

function extractManutencaoPercent(doc: DatasetDoc): number | null {
  const m = doc.metrics?.manutencao
  if (m && isFiniteNumber(m.display)) {
    const unit = m.unit ?? 'fraction'
    return unit === 'fraction' ? m.display * 100 : m.display
  }

  const legacy = doc.maintenancePercent ?? doc.manutencao_percent
  return isFiniteNumber(legacy) ? legacy : null
}

describe('Dataset fields audit', () => {
  it('should have >=80% non-null unit value', async () => {
    const datasetPath = pickDatasetPath()
    const raw = await fs.readFile(datasetPath, 'utf-8')
    const parsed = JSON.parse(raw) as DatasetFile
    const corpus: DatasetDoc[] = Array.isArray(parsed) ? parsed : parsed.corpus

    expect(corpus.length).toBeGreaterThan(0)

    let nonNullValor = 0
    let nonNullVida = 0
    let nonNullManut = 0

    for (const doc of corpus) {
      if (extractValorUnitario(doc) != null) nonNullValor++
      if (extractVidaUtilMeses(doc) != null) nonNullVida++
      if (extractManutencaoPercent(doc) != null) nonNullManut++
    }

    const percentNonNullValor = nonNullValor / corpus.length

    expect(percentNonNullValor).toBeGreaterThanOrEqual(0.8)
    expect(nonNullVida).toBeGreaterThan(0)
    expect(nonNullManut).toBeGreaterThan(0)
  })
})
