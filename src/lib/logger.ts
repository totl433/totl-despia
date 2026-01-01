/**
 * Production-safe logging utility
 * 
 * Automatically filters out debug logs in production builds.
 * Use this instead of console.log/error/warn for better production behavior.
 * 
 * Usage:
 *   import { log } from '../lib/logger';
 *   log.debug('Debug message', { data });
 *   log.info('Info message');
 *   log.warn('Warning message');
 *   log.error('Error message', error);
 */

const isDev = import.meta.env.DEV;

interface LogData {
  [key: string]: unknown;
}

class Logger {
  /**
   * Debug logs - only shown in development
   * Use for detailed debugging information
   */
  debug(message: string, data?: LogData): void {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  /**
   * Info logs - shown in all environments
   * Use for important informational messages
   */
  info(message: string, data?: LogData): void {
    console.log(`[INFO] ${message}`, data || '');
  }

  /**
   * Warning logs - shown in all environments
   * Use for warnings that should be visible in production
   */
  warn(message: string, data?: LogData): void {
    console.warn(`[WARN] ${message}`, data || '');
  }

  /**
   * Error logs - always shown
   * Use for errors that need attention
   */
  error(message: string, error?: Error | LogData | unknown): void {
    console.error(`[ERROR] ${message}`, error || '');
  }

  /**
   * Component-specific logger
   * Creates a logger with a component prefix
   * 
   * Usage:
   *   const log = logger.for('ComponentName');
   *   log.debug('Message'); // [ComponentName] [DEBUG] Message
   */
  for(component: string): Logger {
    return {
      debug: (message: string, data?: LogData) => {
        if (isDev) {
          console.log(`[${component}] [DEBUG] ${message}`, data || '');
        }
      },
      info: (message: string, data?: LogData) => {
        console.log(`[${component}] [INFO] ${message}`, data || '');
      },
      warn: (message: string, data?: LogData) => {
        console.warn(`[${component}] [WARN] ${message}`, data || '');
      },
      error: (message: string, error?: Error | LogData | unknown) => {
        console.error(`[${component}] [ERROR] ${message}`, error || '');
      },
      for: this.for.bind(this),
    };
  }
}

export const log = new Logger();


