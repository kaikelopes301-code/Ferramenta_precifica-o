// frontend/lib/api.ts

// Preferimos chamar o backend via rotas internas do Next (`/api/...`),
// que fazem proxy server-side para o backend real.
//
// Caso você precise chamar o backend diretamente no browser,
// configure uma destas variáveis:
// - NEXT_PUBLIC_API_BASE_URL (recomendado)
// - NEXT_PUBLIC_BACKEND_URL (legado)
//
// IMPORTANTE: não defaultar para http://localhost em produção,
// para evitar `Failed to fetch` quando o frontend está hospedado.
export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL ||
	process.env.NEXT_PUBLIC_BACKEND_URL ||
	'';
