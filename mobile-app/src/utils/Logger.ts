/**
 * Logger utility that only logs in development (__DEV__)
 * Strips all logs from production builds automatically
 */

const isDev = __DEV__;

export const Logger = {
  /**
   * Debug logs - only in development
   * Use for: General debugging, variable inspection, flow tracking
   */
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info logs - only in development
   * Use for: Important state changes, configuration info
   */
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning logs - only in development
   * Use for: Non-critical issues, deprecated usage
   */
  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Error logs - ALWAYS logged (even in production)
   * Use for: Errors that need to be tracked
   * TODO: Integrate with error tracking service (Sentry, etc.)
   */
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
    // Future: Send to error tracking service
  },

  /**
   * API logs - only in development
   * Use for: API request/response logging
   */
  api: (endpoint: string, method: string, data?: any) => {
    if (isDev) {
      console.log(`[API] ${method} ${endpoint}`, data ? data : '');
    }
  },

  /**
   * Group logs - only in development
   * Use for: Grouping related logs
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label);
    }
  },

  /**
   * End group - only in development
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /**
   * Table logs - only in development
   * Use for: Displaying tabular data
   */
  table: (data: any) => {
    if (isDev) {
      console.table(data);
    }
  },
};

export default Logger;
