/**
 * Structured logging utility for TOTL app.
 * Used to instrument boot flow, data loading, and debug production issues.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEvent {
  name: string;
  level?: LogLevel;
  data?: Record<string, unknown>;
}

/**
 * Log a structured event to the console.
 * In production, this could be extended to send to a logging service.
 */
export function logEvent({ name, level = 'info', data }: LogEvent): void {
  const timestamp = new Date().toISOString();
  const prefix = `[TOTL][${timestamp}]`;
  
  const message = data 
    ? `${prefix} ${name} ${JSON.stringify(data)}`
    : `${prefix} ${name}`;
  
  switch (level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'debug':
      console.debug(message);
      break;
    case 'info':
    default:
      console.log(message);
  }
}

/**
 * Convenience functions for common log levels
 */
export const log = {
  info: (name: string, data?: Record<string, unknown>) => 
    logEvent({ name, level: 'info', data }),
  
  warn: (name: string, data?: Record<string, unknown>) => 
    logEvent({ name, level: 'warn', data }),
  
  error: (name: string, data?: Record<string, unknown>) => 
    logEvent({ name, level: 'error', data }),
  
  debug: (name: string, data?: Record<string, unknown>) => 
    logEvent({ name, level: 'debug', data }),
};

/**
 * Boot flow logging helpers
 */
export const bootLog = {
  authStart: () => log.info('boot/auth_start'),
  authSuccess: (userId?: string) => log.info('boot/auth_success', { userId: userId?.slice(0, 8) }),
  authTimeout: () => log.warn('boot/auth_timeout'),
  authError: (error: string) => log.error('boot/auth_error', { error }),
  
  initialDataStart: (userId?: string) => log.info('boot/initial_data_start', { userId: userId?.slice(0, 8) }),
  initialDataSuccess: (duration: number) => log.info('boot/initial_data_success', { durationMs: duration }),
  initialDataTimeout: () => log.warn('boot/initial_data_timeout'),
  initialDataError: (error: string) => log.error('boot/initial_data_error', { error }),
};

/**
 * Data source type for cache quality logging
 */
type DataSource = 'cache' | 'network' | 'prewarm' | 'mixed';

/**
 * Page-level logging helpers with cache quality metrics
 */
export const pageLog = {
  /**
   * Log initial league data load (usually from cache)
   */
  leaguesInitial: (
    page: string, 
    count: number, 
    firstIds: string[],
    options?: { source?: DataSource; cacheAgeMs?: number | null }
  ) => 
    log.info(`${page}/leagues_initial`, { 
      count, 
      firstIds: firstIds.slice(0, 3).map(id => id.slice(0, 8)),
      source: options?.source ?? 'cache',
      cacheAgeMs: options?.cacheAgeMs ?? null,
    }),
  
  /**
   * Log league data refresh (usually from network)
   */
  leaguesRefresh: (
    page: string, 
    count: number, 
    firstIds: string[],
    options?: { source?: DataSource; fetchDurationMs?: number }
  ) => 
    log.info(`${page}/leagues_refresh`, { 
      count, 
      firstIds: firstIds.slice(0, 3).map(id => id.slice(0, 8)),
      source: options?.source ?? 'network',
      fetchDurationMs: options?.fetchDurationMs ?? null,
    }),
  
  /**
   * Log cache hit with quality metrics
   */
  cacheHit: (key: string, meta?: { ageMs?: number; freshnessPercent?: number }) => 
    log.debug('cache/hit', { key, ...meta }),
  
  /**
   * Log cache miss
   */
  cacheMiss: (key: string, reason?: string) => 
    log.debug('cache/miss', { key, reason }),
};

