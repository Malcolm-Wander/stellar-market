import pino from "pino";
import { getRequestId } from "./request-context";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      'req.headers["authorization"]',
      "headers.authorization",
      "*.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  mixin() {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  },
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
});

export function installRequestIdConsolePatch(): void {
  const g = global as any;
  if (g.__requestId_console_patched) return;

  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
  };

  console.log = (...args: any[]) => {
    try {
      logger.info({ args }, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch (e) {
      orig.log(...args);
    }
  };
  console.info = (...args: any[]) => {
    try {
      logger.info({ args }, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch (e) {
      orig.info(...args);
    }
  };
  console.warn = (...args: any[]) => {
    try {
      logger.warn({ args }, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch (e) {
      orig.warn(...args);
    }
  };
  console.debug = (...args: any[]) => {
    try {
      logger.debug({ args }, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch (e) {
      orig.debug(...args);
    }
  };
  console.error = (...args: any[]) => {
    try {
      const first = args[0];
      if (first instanceof Error) {
        logger.error({ err: first }, first.message);
      } else {
        logger.error({ args }, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      }
    } catch (e) {
      orig.error(...args);
    }
  };

  g.__requestId_console_patched = true;
}
