/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Evita corrida entre arquivos (E2E inicia servidor + DB singleton)
    // e outros testes que inicializam/fecham a mesma conexão.
    fileParallelism: false,
    maxConcurrency: 1,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
    testTimeout: 10000,
  },
})
