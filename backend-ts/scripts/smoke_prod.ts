import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

type JsonObject = Record<string, unknown>

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`[SMOKE_PROD][FAIL] ${message}`)
  process.exit(1)
}

function info(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[SMOKE_PROD] ${message}`)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((res) => setTimeout(res, ms))
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/api/health`)
      if (r.ok) return
    } catch {
      // ignore until timeout
    }
    await sleep(250)
  }
  fail(`Health timeout: GET ${baseUrl}/api/health`)
}

function startServer(env: NodeJS.ProcessEnv): { proc: ChildProcessWithoutNullStreams; stop: () => void } {
  info('Starting server: node dist/index.js')

  const proc = spawn(process.execPath, ['dist/index.js'], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  proc.stdout.setEncoding('utf8')
  proc.stderr.setEncoding('utf8')

  proc.stdout.on('data', (chunk) => {
    // keep output minimal for CI
    const text = String(chunk).trim()
    if (text.length > 0) console.log(text)
  })

  proc.stderr.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text.length > 0) console.error(text)
  })

  const stop = () => {
    if (!proc.killed) {
      proc.kill('SIGKILL')
    }
  }

  return { proc, stop }
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.PORT || '4000', 10)
  if (!Number.isFinite(port) || port <= 0) {
    fail(`PORT inválida: '${process.env.PORT ?? ''}'`) 
  }

  const repoRoot = process.cwd()
  const dataDir = path.join(repoRoot, 'data')
  await fs.mkdir(dataDir, { recursive: true })

  const dbPath = process.env.DATABASE_PATH?.trim()
    ? process.env.DATABASE_PATH
    : path.join(dataDir, `smoke_prod_${process.pid}.db`)

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    LOG_LEVEL: process.env.LOG_LEVEL?.trim() ? process.env.LOG_LEVEL : 'error',
    DATABASE_PATH: dbPath,
    PRINT_ROUTES: 'false',
  }

  const baseUrl = `http://127.0.0.1:${port}`

  const { proc, stop } = startServer(env)

  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    if (code !== null && code !== 0) {
      fail(`Server exited early with code=${code}`)
    }
    if (signal) {
      fail(`Server exited early with signal=${signal}`)
    }
  }

  proc.on('exit', onExit)

  try {
    await waitForHealth(baseUrl, 30_000)
    info('Health OK (200)')

    // OBS: /api/search (TS) valida via Zod: { query, top_k, min_score, use_cache }
    // Para evitar ambiguidade futura, enviamos tanto `descricao` quanto `query`.
    const body: JsonObject = {
      descricao: 'vassoura',
      query: 'vassoura',
      top_k: 5,
    }

    const r = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': 'smoke-prod' },
      body: JSON.stringify(body),
    })

    const text = await r.text()
    if (!r.ok) {
      const snippet = text.length > 400 ? `${text.slice(0, 400)}…` : text
      fail(`Search failed status=${r.status}. Body: ${snippet}`)
    }

    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      const snippet = text.length > 400 ? `${text.slice(0, 400)}…` : text
      fail(`Search response is not valid JSON. Body: ${snippet}`)
    }

    const resultados = Array.isArray(json?.resultados) ? json.resultados : []
    if (resultados.length === 0) {
      fail('Search returned 200 but no resultados')
    }

    const top1 = resultados[0] ?? {}
    const title = (top1?.title ?? top1?.descricao ?? top1?.grupo) as unknown
    const valorUnitario = (top1?.valor_unitario ?? top1?.valorUnitario) as unknown
    info(`Search OK (200) resultados=${resultados.length}`)
    info(`top1.title=${String(title ?? '')}`)
    info(`top1.valor_unitario=${String(valorUnitario ?? '')}`)

    process.exit(0)
  } finally {
    info(`Stopping server (pid=${proc.pid})`)
    stop()
  }
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  fail(msg)
})
