/**
 * Details Routes - Equipment Details by Group
 * 
 * Provides detailed information about equipment in a specific group.
 * Used by frontend detalhes/page.tsx for displaying full equipment lists.
 */

import type { FastifyPluginAsync } from 'fastify';
import type { CorpusRepository } from '../../infra/corpusRepository.js';
import type { CorpusDocument } from '../../domain/searchEngine.js';
import { logger } from '../../infra/logging.js';

interface DetailsParams {
    grupo: string;
}

/**
 * Equipment detail item for API response
 */
interface EquipmentDetailDTO {
    fornecedor?: string;
    marca?: string;
    descricao: string;
    valor_unitario?: number;
    vida_util_meses?: number;
    manutencao?: number;
}

/**
 * Details response structure
 */
interface DetailsResponse {
    grupo: string;
    items: EquipmentDetailDTO[];
    total: number;
}

export const detailsRoutes: FastifyPluginAsync = async (fastify) => {
    let loggedMissingCorpus = false;

    /**
     * GET /api/detalhes/:grupo
     * 
     * Returns all equipment items for a specific group
     * 
     * @param grupo - Equipment group ID (URL encoded)
     * @returns List of equipment with details
     */
    fastify.get<{ Params: DetailsParams }>(
        '/api/detalhes/:grupo',
        {
            schema: {
                params: {
                    type: 'object',
                    required: ['grupo'],
                    properties: {
                        grupo: {
                            type: 'string',
                            description: 'Equipment group ID (URL encoded)'
                        }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            grupo: { type: 'string' },
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        fornecedor: { type: 'string', nullable: true },
                                        marca: { type: 'string', nullable: true },
                                        descricao: { type: 'string' },
                                        valor_unitario: { type: 'number', nullable: true },
                                        vida_util_meses: { type: 'number', nullable: true },
                                        manutencao: { type: 'number', nullable: true }
                                    }
                                }
                            },
                            total: { type: 'number' }
                        }
                    },
                    503: {
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            code: { type: 'string' }
                        }
                    },
                    404: {
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            grupo: { type: 'string' }
                        }
                    }
                }
            }
        },
        async (request, reply) => {
            const corpusRepo = fastify.corpusRepository as CorpusRepository | undefined;
            if (!corpusRepo) {
                if (!loggedMissingCorpus) {
                    loggedMissingCorpus = true;
                    logger.error('[detailsRoutes] CorpusRepository missing - returning 503 (service not ready)');
                }
                return reply.status(503).send({
                    error: 'Service not ready',
                    code: 'CORPUS_NOT_READY',
                });
            }

            const { grupo } = request.params;
            const grupoDecoded = decodeURIComponent(grupo);

            logger.info(`[detailsRoutes] Fetching details for grupo: ${grupoDecoded}`);

            try {
                // Prefer repository-level filtering when available.
                // Fallback to scanning all documents for legacy implementations.
                const groupDocs: CorpusDocument[] = 'getDocumentsByGroupId' in (corpusRepo as any)
                    ? (await (corpusRepo as any).getDocumentsByGroupId(grupoDecoded)) as CorpusDocument[]
                    : (await corpusRepo.getAllDocuments()).filter((doc: CorpusDocument) =>
                        doc.groupId === grupoDecoded ||
                        doc.groupId?.toLowerCase?.() === grupoDecoded.toLowerCase()
                    );

                if (groupDocs.length === 0) {
                    logger.warn(`[detailsRoutes] No documents found for grupo: ${grupoDecoded}`);
                    return reply.status(404).send({
                        error: 'Grupo não encontrado',
                        grupo: grupoDecoded
                    });
                }

                // Transform to response format
                const items: EquipmentDetailDTO[] = groupDocs.map((doc: CorpusDocument) => ({
                    fornecedor: doc.supplier,
                    marca: doc.brand,
                    descricao: doc.rawText || doc.groupDescription || doc.text,
                    valor_unitario: doc.price,
                    vida_util_meses: doc.lifespanMonths,
                    manutencao: doc.maintenancePercent
                }));

                const response: DetailsResponse = {
                    grupo: grupoDecoded,
                    items,
                    total: items.length
                };

                logger.info(`[detailsRoutes] Found ${items.length} items for grupo: ${grupoDecoded}`);
                
                return reply.send(response);

            } catch (error) {
                logger.error('[detailsRoutes] Error fetching details:', error);
                return reply.status(500).send({
                    error: 'Erro ao buscar detalhes',
                    grupo: grupoDecoded
                });
            }
        }
    );

    logger.info('[detailsRoutes] ✅ Registered: GET /api/detalhes/:grupo');
};
