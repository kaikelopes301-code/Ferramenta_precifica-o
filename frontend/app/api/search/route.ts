import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = request.headers.get('x-user-id')

    const r = await fetch(`${BACKEND_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    })

    const data = await r.json().catch(() => ({ resultados: [], error: 'invalid_json' }))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { resultados: [], error: 'proxy_error', detail: e?.message },
      { status: 503 },
    )
  }
}
