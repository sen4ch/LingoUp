import type { LoggerService } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';

type Level = 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal';

/**
 * Routes NestJS logs into Fastify's pino instance, so application and request logs share
 * one JSON format and the same redaction rules.
 * Accepts `logger.warn({ ...fields }, 'message')` as well as plain string messages.
 */
export class PinoLoggerService implements LoggerService {
  constructor(private readonly pino: FastifyBaseLogger) {}

  log(message: unknown, ...params: unknown[]) {
    this.write('info', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.write('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.write('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.write('trace', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.write('fatal', message, params);
  }

  private write(level: Level, message: unknown, params: unknown[]): void {
    // Nest appends the context (logger name) as the last parameter.
    const context =
      params.length > 0 && typeof params.at(-1) === 'string'
        ? (params.at(-1) as string)
        : undefined;
    const rest = context === undefined ? params : params.slice(0, -1);
    if (message !== null && typeof message === 'object' && !(message instanceof Error)) {
      const text = typeof rest[0] === 'string' ? rest[0] : undefined;
      this.pino[level]({ context, ...(message as Record<string, unknown>) }, text);
      return;
    }
    if (message instanceof Error) {
      this.pino[level]({ context, err: message }, message.message);
      return;
    }
    // Nest passes the stack trace as the second argument of error().
    const stack = level === 'error' && typeof rest[0] === 'string' ? rest[0] : undefined;
    this.pino[level]({ context, ...(stack ? { stack } : {}) }, String(message));
  }
}
