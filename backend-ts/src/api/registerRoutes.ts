import type { FastifyInstance } from 'fastify'

import { registerSearchRoutes } from './searchRoutes.js'
import { historyRoutes } from './routes/historyRoutes.js'
import { favoritesRoutes } from './routes/favoritesRoutes.js'
import { kitRoutes } from './routes/kitRoutes.js'
import { dataRoutes } from './routes/dataRoutes.js'
import { detailsRoutes } from './routes/detailsRoutes.js'

export type RegisteredRoute = {
  method: string
  path: string
  source: string
}

type RoutePlugin = (app: FastifyInstance) => void | Promise<void>

function registerWithSource(app: FastifyInstance, plugin: RoutePlugin, source: string, routes: RegisteredRoute[]): void {
  void app.register(async (instance) => {
    instance.addHook('onRoute', (routeOptions) => {
      const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
      for (const method of methods) {
        routes.push({ method, path: routeOptions.url, source })
      }
    })

    await plugin(instance)
  })
}

/**
 * Única fonte de verdade para o registro de rotas do backend.
 *
 * Também captura uma lista de rotas registradas (método + path + source)
 * para auditoria/diagnóstico em ambiente de desenvolvimento.
 */
export function registerRoutes(app: FastifyInstance): void {
  const routes: RegisteredRoute[] = []

  if (!app.getRegisteredRoutes) {
    app.decorate('getRegisteredRoutes', () => routes.slice())
  }

  registerWithSource(app, registerSearchRoutes, 'src/api/searchRoutes.ts', routes)
  registerWithSource(app, historyRoutes, 'src/api/routes/historyRoutes.ts', routes)
  registerWithSource(app, favoritesRoutes, 'src/api/routes/favoritesRoutes.ts', routes)
  registerWithSource(app, kitRoutes, 'src/api/routes/kitRoutes.ts', routes)
  registerWithSource(app, dataRoutes, 'src/api/routes/dataRoutes.ts', routes)
  registerWithSource(
    app,
    async (instance) => {
      await instance.register(detailsRoutes)
    },
    'src/api/routes/detailsRoutes.ts',
    routes
  )
}
