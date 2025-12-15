import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('C:/afm-precificacao-equipamentos-production/backend-ts')
const srcRoot = path.join(root, 'src')
const entry = path.join(srcRoot, 'index.ts')

function listTsFiles(dir) {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    let ents = []
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of ents) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) stack.push(p)
      else if (ent.isFile() && p.endsWith('.ts')) out.push(p)
    }
  }
  return out
}

const allFiles = listTsFiles(srcRoot)
const allSet = new Set(allFiles.map((f) => path.normalize(f)))

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

const importRe = /\bimport\s+(?:type\s+)?[^;]*?\sfrom\s+['\"]([^'\"]+)['\"]/g
const sideEffectImportRe = /\bimport\s+['\"]([^'\"]+)['\"]/g
const exportFromRe = /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['\"]([^'\"]+)['\"]/g
const dynamicRe = /\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g

function resolveSpec(fromFile, spec) {
  if (!spec || spec[0] !== '.') return null

  let s = spec
  if (s.endsWith('.js')) s = s.slice(0, -3) + '.ts'

  const base = path.resolve(path.dirname(fromFile), s)
  const candidates = []
  if (base.endsWith('.ts')) candidates.push(base)
  else {
    candidates.push(base + '.ts')
    candidates.push(path.join(base, 'index.ts'))
  }

  for (const c of candidates) {
    const n = path.normalize(c)
    if (allSet.has(n)) return n
  }
  return null
}

function depsOf(file) {
  const text = readText(file)
  const specs = []

  let m = null
  importRe.lastIndex = 0
  while ((m = importRe.exec(text))) specs.push(m[1])

  exportFromRe.lastIndex = 0
  while ((m = exportFromRe.exec(text))) specs.push(m[1])

  sideEffectImportRe.lastIndex = 0
  while ((m = sideEffectImportRe.exec(text))) {
    const spec = m[1]
    if (spec && spec[0] === '.') specs.push(spec)
  }

  dynamicRe.lastIndex = 0
  while ((m = dynamicRe.exec(text))) specs.push(m[1])

  const out = []
  for (const spec of specs) {
    const r = resolveSpec(file, spec)
    if (r) out.push(r)
  }
  return out
}

const reachable = new Set()
const q = []

const entryN = path.normalize(entry)
if (!allSet.has(entryN)) {
  console.error('Entry not found:', entry)
  process.exit(1)
}

reachable.add(entryN)
q.push(entryN)

while (q.length) {
  const f = q.shift()
  const deps = depsOf(f)
  for (const d of deps) {
    if (!reachable.has(d)) {
      reachable.add(d)
      q.push(d)
    }
  }
}

const unreachable = allFiles
  .filter((f) => !reachable.has(path.normalize(f)))
  .map((f) => path.relative(srcRoot, f).replace(/\\/g, '/'))
  .sort()

function isScript(p) {
  return p.startsWith('scripts/')
}

const unreachableScripts = unreachable.filter(isScript)
const unreachableNonScripts = unreachable.filter((p) => !isScript(p))

const report = {
  root,
  entry: 'src/index.ts',
  totals: {
    totalTsFiles: allFiles.length,
    reachable: reachable.size,
    unreachable: unreachable.length,
    unreachableScripts: unreachableScripts.length,
    unreachableNonScripts: unreachableNonScripts.length,
  },
  samples: {
    unreachableNonScripts: unreachableNonScripts.slice(0, 50),
  },
}

console.log(JSON.stringify(report, null, 2))
