/**
 * Simple logger for the application
 * Enhanced to support object meta
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getCurrentLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase()
  if (level && level in LOG_LEVELS) {
    return level as LogLevel
  }
  return 'info'
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getCurrentLogLevel()]
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
    })
  }

  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify(String(value))
  }
}

function formatMessage(
  level: LogLevel,
  messageOrMeta: string | Record<string, unknown>,
  messageOrMeta2?: unknown
): string {
  const timestamp = new Date().toISOString()

  if (typeof messageOrMeta === 'string') {
    const metaStr = messageOrMeta2 == null ? '' : ` ${safeStringify(messageOrMeta2)}`
    return `[${timestamp}] [${level.toUpperCase()}] ${messageOrMeta}${metaStr}`
  }

  const msg = typeof messageOrMeta2 === 'string' ? messageOrMeta2 : ''
  const metaStr = JSON.stringify(messageOrMeta)
  return `[${timestamp}] [${level.toUpperCase()}] ${msg} ${metaStr}`
}

function debug(message: string, meta?: unknown): void
function debug(meta: Record<string, unknown>, message?: string): void
function debug(messageOrMeta: string | Record<string, unknown>, messageOrMeta2?: unknown): void {
  if (!shouldLog('debug')) return

  if (typeof messageOrMeta === 'string') {
    console.debug(formatMessage('debug', messageOrMeta, messageOrMeta2))
    return
  }

  const msg = typeof messageOrMeta2 === 'string' ? messageOrMeta2 : undefined
  console.debug(formatMessage('debug', messageOrMeta, msg))
}

function info(message: string, meta?: unknown): void
function info(meta: Record<string, unknown>, message?: string): void
function info(messageOrMeta: string | Record<string, unknown>, messageOrMeta2?: unknown): void {
  if (!shouldLog('info')) return

  if (typeof messageOrMeta === 'string') {
    console.info(formatMessage('info', messageOrMeta, messageOrMeta2))
    return
  }

  const msg = typeof messageOrMeta2 === 'string' ? messageOrMeta2 : undefined
  console.info(formatMessage('info', messageOrMeta, msg))
}

function warn(message: string, meta?: unknown): void
function warn(meta: Record<string, unknown>, message?: string): void
function warn(messageOrMeta: string | Record<string, unknown>, messageOrMeta2?: unknown): void {
  if (!shouldLog('warn')) return

  if (typeof messageOrMeta === 'string') {
    console.warn(formatMessage('warn', messageOrMeta, messageOrMeta2))
    return
  }

  const msg = typeof messageOrMeta2 === 'string' ? messageOrMeta2 : undefined
  console.warn(formatMessage('warn', messageOrMeta, msg))
}

function error(message: string, meta?: unknown): void
function error(meta: Record<string, unknown>, message?: string | unknown): void
function error(messageOrMeta: string | Record<string, unknown>, messageOrMeta2?: unknown): void {
  if (!shouldLog('error')) return

  if (typeof messageOrMeta === 'string') {
    console.error(formatMessage('error', messageOrMeta, messageOrMeta2))
    return
  }

  const msg = typeof messageOrMeta2 === 'string' ? messageOrMeta2 : undefined
  console.error(formatMessage('error', messageOrMeta, msg))
}

export const logger = {
  debug,
  info,
  warn,
  error,
}

export default logger
