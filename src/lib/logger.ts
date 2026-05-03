type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(_message: string, _context?: LogContext) {
    // Disabled to reduce console noise - uncomment if needed for debugging
    // console.log(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatMessage("error", message, context));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug(_message: string, _context?: LogContext) {
    // Disabled to reduce console noise - uncomment if needed for debugging
    // if (process.env.NODE_ENV === "development") {
    //   console.debug(this.formatMessage("debug", message, context));
    // }
  }
}

export const logger = new Logger();
