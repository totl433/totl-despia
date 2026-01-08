/**
 * Data fetch logging utility
 * Logs Supabase queries and their results for debugging
 */

export interface DataFetchLog {
  timestamp: number;
  location: string; // Where the query was made (e.g., "loadHomePageData")
  query: string; // Description of query (e.g., "Fetch league members")
  table: string; // Table/view name
  filters?: Record<string, any>; // Query filters
  result: 'success' | 'error' | 'empty';
  rowCount?: number;
  error?: string;
  dataPreview?: any; // First few rows for debugging (sanitized)
}

const MAX_LOGS = 100; // Keep last 100 fetch logs
const STORAGE_KEY = 'data_fetch_logs';

/**
 * Log a data fetch operation
 */
export function logDataFetch(
  location: string,
  query: string,
  table: string,
  result: { data: any; error: any },
  filters?: Record<string, any>
): void {
  try {
    const existingLogs = localStorage.getItem(STORAGE_KEY);
    const logs: DataFetchLog[] = existingLogs ? JSON.parse(existingLogs) : [];

    const rowCount = result.data ? (Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0) : 0;
    const logResult: DataFetchLog['result'] = result.error ? 'error' : rowCount === 0 ? 'empty' : 'success';

    // Sanitize data preview (limit size and remove sensitive info)
    let dataPreview: any = undefined;
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      dataPreview = result.data.slice(0, 3).map((row: any) => {
        const sanitized: any = {};
        // Only include safe fields
        Object.keys(row).slice(0, 10).forEach(key => {
          const value = row[key];
          if (typeof value === 'string' && value.length > 100) {
            sanitized[key] = value.slice(0, 100) + '...';
          } else {
            sanitized[key] = value;
          }
        });
        return sanitized;
      });
    } else if (result.data && !Array.isArray(result.data)) {
      const row = result.data;
      dataPreview = {};
      Object.keys(row).slice(0, 10).forEach(key => {
        const value = row[key];
        if (typeof value === 'string' && value.length > 100) {
          dataPreview[key] = value.slice(0, 100) + '...';
        } else {
          dataPreview[key] = value;
        }
      });
    }

    const log: DataFetchLog = {
      timestamp: Date.now(),
      location,
      query,
      table,
      filters,
      result: logResult,
      rowCount,
      error: result.error?.message || result.error?.toString(),
      dataPreview,
    };

    logs.push(log);

    // Keep only last MAX_LOGS
    const recentLogs = logs.slice(-MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentLogs));
  } catch (e) {
    console.error('[dataFetchLogger] Failed to log fetch:', e);
  }
}

/**
 * Get all fetch logs
 */
export function getDataFetchLogs(): DataFetchLog[] {
  try {
    const logs = localStorage.getItem(STORAGE_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error('[dataFetchLogger] Failed to get logs:', e);
    return [];
  }
}

/**
 * Clear all fetch logs
 */
export function clearDataFetchLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[dataFetchLogger] Failed to clear logs:', e);
  }
}
