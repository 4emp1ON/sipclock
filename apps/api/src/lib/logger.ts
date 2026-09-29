export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

/** Minimal structured JSON logger: one JSON object per line on stdout (stderr for errors). */
export function createLogger(
  level: LogLevel,
  write: (line: string, isError: boolean) => void = (line, isError) => {
    (isError ? process.stderr : process.stdout).write(`${line}\n`);
  },
): Logger {
  const threshold = order[level];
  const emit = (lvl: Exclude<LogLevel, 'silent'>, msg: string, fields?: LogFields) => {
    if (order[lvl] < threshold) return;
    write(
      JSON.stringify({ level: lvl, time: new Date().toISOString(), msg, ...fields }),
      lvl === 'error',
    );
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  };
}

export const silentLogger: Logger = createLogger('silent');
