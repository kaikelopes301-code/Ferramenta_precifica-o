import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ grupo: string }> },
) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'missing_env', detail: 'BACKEND_URL não configurado no ambiente do frontend (Vercel).' },
      { status: 500 },
    )
  }

  try {
    const { grupo } = await params

    const r = await fetch(`${BACKEND_URL}/api/detalhes/${encodeURIComponent(grupo)}`, {
      cache: 'no-store',
    })

    const data = await r.json().catch(() => ({ error: 'invalid_json' }))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'proxy_error', detail: e?.message },
      { status: 503 },
    )
  }
}
