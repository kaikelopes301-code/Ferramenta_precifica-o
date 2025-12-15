import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

type NumericMetrics = {
	display: number
	mean: number
	median: number
	min: number
	max: number
	n: number
	unit?: 'fraction' | 'percent'
}

type DatasetDoc = {
	id?: string
	groupId?: string
	title?: string
	metrics?: {
		valorUnitario?: NumericMetrics
		vidaUtilMeses?: NumericMetrics
		manutencao?: NumericMetrics
	}
	// legacy (alguns dumps antigos)
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

function sample<T>(arr: T[], n: number): T[] {
	if (arr.length <= n) return [...arr]
	const out: T[] = []
	const used = new Set<number>()
	while (out.length < n) {
		const idx = Math.floor(Math.random() * arr.length)
		if (used.has(idx)) continue
		used.add(idx)
		out.push(arr[idx])
	}
	return out
}

async function main(): Promise<void> {
	const datasetPath = pickDatasetPath()
	const raw = await fs.readFile(datasetPath, 'utf-8')
	const parsed = JSON.parse(raw) as DatasetFile

	const corpus: DatasetDoc[] = Array.isArray(parsed) ? parsed : parsed.corpus

	const samplesArgIdx = process.argv.findIndex((a) => a === '--samples')
	const samplesN = samplesArgIdx >= 0 ? Number(process.argv[samplesArgIdx + 1]) : 30
	const nSamples = Number.isFinite(samplesN) && samplesN > 0 ? Math.floor(samplesN) : 30

	let nonNullValor = 0
	let nonNullVida = 0
	let nonNullManut = 0

	for (const doc of corpus) {
		if (extractValorUnitario(doc) != null) nonNullValor++
		if (extractVidaUtilMeses(doc) != null) nonNullVida++
		if (extractManutencaoPercent(doc) != null) nonNullManut++
	}

	const percent = (count: number) => (corpus.length === 0 ? 0 : (count / corpus.length) * 100)

	console.log('=== audit_fields.ts ===')
	console.log(`Dataset: ${datasetPath}`)
	console.log(`Docs: ${corpus.length}`)
	console.log(
		`percentNonNullValor: ${percent(nonNullValor).toFixed(1)}% | percentNonNullVida: ${percent(nonNullVida).toFixed(1)}% | percentNonNullManut: ${percent(nonNullManut).toFixed(1)}%`
	)
	console.log('--- sample ---')

	const picked = sample(corpus, nSamples)
	for (const doc of picked) {
		const title = doc.title ?? doc.groupId ?? doc.id ?? '(sem título)'
		const groupId = doc.groupId ?? doc.id ?? '(sem groupId)'
		const v = extractValorUnitario(doc)
		const vida = extractVidaUtilMeses(doc)
		const manut = extractManutencaoPercent(doc)

		console.log(
			JSON.stringify(
				{
					title,
					groupId,
					valorUnitario: v,
					vidaUtilMeses: vida,
					manutencaoPct: manut,
				},
				null,
				0
			)
		)
	}

	// Critério solicitado (usado como sinalizador no script também)
	const percentNonNullValor = percent(nonNullValor) / 100
	if (percentNonNullValor < 0.8) {
		process.exitCode = 2
	}
}

main().catch((err) => {
	console.error('[audit_fields] failed:', err)
	process.exitCode = 1
})