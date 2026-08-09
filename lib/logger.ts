enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;
  private isErrorWithStack(value: unknown): value is Error {
    return value instanceof Error;
  }

  constructor() {
    this.level = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case "DEBUG":
        return LogLevel.DEBUG;
      case "INFO":
        return LogLevel.INFO;
      case "WARN":
        return LogLevel.WARN;
      case "ERROR":
        return LogLevel.ERROR;
      default:
        return process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private formatMessage(level: string, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: unknown) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage("DEBUG", message, meta));
    }
  }

  info(message: string, meta?: unknown) {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage("INFO", message, meta));
    }
  }

  warn(message: string, meta?: unknown) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message, meta));
    }
  }

  error(message: string, error?: unknown) {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage("ERROR", message, error));
      if (this.isErrorWithStack(error) && error.stack) {
        console.error(error.stack);
      }
    }
  }

  // Context-aware logging for API routes
  api(route: string, method: string, message: string, meta?: unknown) {
    this.info(`[API] ${method} ${route} - ${message}`, meta);
  }

  // Context-aware logging for Socket.io
  socket(event: string, message: string, meta?: unknown) {
    this.debug(`[SOCKET] ${event} - ${message}`, meta);
  }

  // Context-aware logging for Database operations
  db(operation: string, message: string, meta?: unknown) {
    this.debug(`[DB] ${operation} - ${message}`, meta);
  }
}

export const logger = new Logger();
