import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'missing_env', detail: 'BACKEND_URL não configurado no ambiente do frontend (Vercel).' },
      { status: 500 },
    )
  }

  try {
    const r = await fetch(`${BACKEND_URL}/api/data/status`, { cache: 'no-store' })
    const data = await r.json().catch(() => ({ has_data: false }))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'proxy_error', detail: e?.message },
      { status: 503 },
    )
  }
}
