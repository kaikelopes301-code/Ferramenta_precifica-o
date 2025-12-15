/**
 * Runtime Profile Configuration
 *
 * Mirrors the Python runtime_config.py pattern.
 * Provides profile-based configuration for different deployment scenarios.
 */

export type RuntimeProfile = 'default' | 'free'

export const RUNTIME_PROFILE: RuntimeProfile = (process.env.RUNTIME_PROFILE ?? 'default') as RuntimeProfile

/**
 * Profile-specific settings
 */
export interface ProfileSettings {
  /** Maximum concurrent requests */
  maxConcurrent: number
  /** Request timeout in seconds */
  timeoutSeconds: number
  /** Enable semantic search */
  enableSemantic: boolean
  /** Enable reranking */
  enableReranker: boolean
  /** Maximum batch size */
  maxBatchSize: number
}

/**
 * Profile configurations
 */
export const PROFILES: Record<RuntimeProfile, ProfileSettings> = {
  default: {
    maxConcurrent: 10,
    timeoutSeconds: 30,
    enableSemantic: true,
    enableReranker: true,
    maxBatchSize: 50,
  },
  free: {
    maxConcurrent: 3,
    timeoutSeconds: 25,
    enableSemantic: true,
    enableReranker: false,
    maxBatchSize: 20,
  },
}

/**
 * Get current profile settings
 */
export function getProfileSettings(): ProfileSettings {
  return PROFILES[RUNTIME_PROFILE]
}
