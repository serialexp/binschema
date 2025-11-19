// ABOUTME: Simple logging utility with configurable log levels
// ABOUTME: Used throughout the codebase to control output verbosity

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

let currentLevel = LogLevel.INFO;

// Buffer management for capturing output
const buffers = new Map<string, string[]>();
let activeBuffer: string | null = null;

export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'silent') {
  const levelMap = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
    silent: LogLevel.SILENT
  };
  currentLevel = levelMap[level];
}

function formatArgs(...args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    try {
      return String(arg);
    } catch {
      return '[object]';
    }
  }).join(' ');
}

export const logger = {
  debug: (...args: any[]) => {
    const message = formatArgs(...args);
    if (activeBuffer) {
      buffers.get(activeBuffer)?.push(message);
    } else if (currentLevel <= LogLevel.DEBUG) {
      console.log(...args);
    }
  },
  info: (...args: any[]) => {
    const message = formatArgs(...args);
    if (activeBuffer) {
      buffers.get(activeBuffer)?.push(message);
    } else if (currentLevel <= LogLevel.INFO) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    const message = formatArgs(...args);
    if (activeBuffer) {
      buffers.get(activeBuffer)?.push(message);
    } else if (currentLevel <= LogLevel.WARN) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    const message = formatArgs(...args);
    if (activeBuffer) {
      buffers.get(activeBuffer)?.push(message);
    } else if (currentLevel <= LogLevel.ERROR) {
      console.error(...args);
    }
  },
  // Always output regardless of level (for final summaries, critical info)
  always: (...args: any[]) => {
    console.log(...args);
  },

  // Buffer management
  startBuffer: (name: string) => {
    buffers.set(name, []);
    activeBuffer = name;
  },

  flushBuffer: (name: string): string => {
    activeBuffer = null;
    const buffer = buffers.get(name);
    buffers.delete(name);
    return buffer ? buffer.join('\n') : '';
  }
};
