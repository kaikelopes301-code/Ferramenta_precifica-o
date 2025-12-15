import 'fastify'

import type { CorpusRepository } from '../infra/corpusRepository.js'

declare module 'fastify' {
  interface FastifyInstance {
    corpusRepository?: CorpusRepository

    getRegisteredRoutes?: () => Array<{
      method: string
      path: string
      source: string
    }>
  }
}

export {}
