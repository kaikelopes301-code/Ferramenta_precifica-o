import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizeText } from '../src/utils/textNormalization.js'

type AnyDoc = Record<string, any>

function findRootDir(): string {
  let currentDir = process.cwd()
  if (currentDir.endsWith('backend-ts')) {
    return path.resolve(currentDir, '..')
  }
  return currentDir
}

async function loadDataset(filePath: string): Promise<AnyDoc[]> {
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && parsed[0]?.corpus && Array.isArray(parsed[0].corpus)) return parsed[0].corpus
    return parsed
  }
  if (parsed?.corpus && Array.isArray(parsed.corpus)) return parsed.corpus
  throw new Error('Formato de dataset desconhecido (esperado array ou {corpus: []}).')
}

function getGroupId(doc: AnyDoc): string {
  return String(doc.groupId ?? doc.equipmentId ?? doc.id ?? '')
}

function getTitle(doc: AnyDoc): string {
  return String(doc.title ?? doc.rawText ?? doc.groupId ?? doc.equipmentId ?? doc.id ?? '')
}

async function main() {
  const termRaw = process.argv[2] ?? 'vassoura'
  const term = normalizeText(termRaw)

  const root = findRootDir()
  const defaultFile = path.join(root, 'data', 'dataset_ts.json')
  const fileArgIdx = process.argv.indexOf('--file')
  const filePath = fileArgIdx !== -1 ? String(process.argv[fileArgIdx + 1]) : defaultFile

  const corpus = await loadDataset(filePath)

  const matches = corpus
    .map((doc) => {
      const title = getTitle(doc)
      const rawText = String(doc.rawText ?? '')
      const normalizedHaystack = normalizeText(`${title} ${rawText}`)
      return { doc, groupId: getGroupId(doc), title, normalizedHaystack }
    })
    .filter((x) => x.normalizedHaystack.includes(term))

  const uniqueGroups = new Map<string, { groupId: string; title: string }>()
  for (const m of matches) {
    if (!uniqueGroups.has(m.groupId)) {
      uniqueGroups.set(m.groupId, { groupId: m.groupId, title: m.title })
    }
  }

  console.log(`\n[AUDIT_CATEGORY] termo="${termRaw}" normalized="${term}"`)
  console.log(`[AUDIT_CATEGORY] dataset=${filePath}`)
  console.log(`[AUDIT_CATEGORY] total_itens_match=${matches.length}`)
  console.log(`[AUDIT_CATEGORY] grupos_unicos_match=${uniqueGroups.size}`)

  const rows = Array.from(uniqueGroups.values()).sort((a, b) => a.groupId.localeCompare(b.groupId))
  for (const r of rows) {
    console.log(`- groupId=${r.groupId} title="${r.title}"`)
  }
}

main().catch((err) => {
  console.error('[AUDIT_CATEGORY] ERRO:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
