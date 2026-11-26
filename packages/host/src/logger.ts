export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

export type LogSink = (rec: LogRecord) => void;

const defaultSink: LogSink = (rec) => {
  const line = JSON.stringify(rec);
  if (rec.level === "error") console.error(line);
  else console.log(line);
};

export function createLogger(sink: LogSink = defaultSink) {
  const emit = (level: LogLevel, msg: string, extra: Record<string, unknown> = {}) => {
    sink({ level, msg, ts: new Date().toISOString(), ...extra });
  };
  return {
    debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
  };
}

export type Logger = ReturnType<typeof createLogger>;
