// frontend/lib/api.ts

// Backend TypeScript rodando em http://localhost:4000
// Em produção, usar variável de ambiente NEXT_PUBLIC_BACKEND_URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
