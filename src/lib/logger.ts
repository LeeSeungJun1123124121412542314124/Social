type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: number;

  constructor() {
    this.level =
      LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? "info"] ?? 1;
  }

  debug(message: string, ...args: unknown[]) {
    this.log("debug", message, ...args);
  }
  info(message: string, ...args: unknown[]) {
    this.log("info", message, ...args);
  }
  warn(message: string, ...args: unknown[]) {
    this.log("warn", message, ...args);
  }
  error(message: string, ...args: unknown[]) {
    this.log("error", message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    if (LOG_LEVELS[level] < this.level) return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const logFn =
      level === "debug" ? console.log : console[level as "info" | "warn" | "error"];
    if (args.length > 0) {
      logFn(`${prefix} ${message}`, ...args);
    } else {
      logFn(`${prefix} ${message}`);
    }
  }
}

export const logger = new Logger();
