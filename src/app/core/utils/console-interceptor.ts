import { LogLevel, LogLevelPriority, LogPayload } from '../models';
import { isDevMode } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Configuration for the logging system
 */
interface LoggerConfig {
  serverLevel: LogLevel; // Minimum level to send to server
  browserLevel: LogLevel; // Minimum level to show in browser
}

const config: LoggerConfig = {
  serverLevel: (environment as any).serverLogLevel || (isDevMode() ? 'debug' : 'warn'),
  browserLevel: (environment as any).logLevel || (isDevMode() ? 'debug' : 'error'), 
};

/**
 * Allows updating log levels at runtime (e.g., via browser console)
 */
export function setLogLevels(browserLevel: LogLevel, serverLevel?: LogLevel): void {
  config.browserLevel = browserLevel;
  if (serverLevel) config.serverLevel = serverLevel;
  console.info(`[Logger] Níveis atualizados -> Browser: ${config.browserLevel}, Server: ${config.serverLevel}`);
}

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  debug: console.debug,
  error: console.error,
};

/**
 * Structured Logger that can be used instead of console
 */
export const Logger = {
  debug: (...args: any[]) => handleLog('debug', args),
  info:  (...args: any[]) => handleLog('info', args),
  log:   (...args: any[]) => handleLog('log', args),
  warn:  (...args: any[]) => handleLog('warn', args),
  error: (...args: any[]) => handleLog('error', args),
};

function handleLog(level: LogLevel, args: any[]) {
  try {
    const priority = LogLevelPriority[level];

    // Check if should show in browser
    if (!isDevMode() && level === 'error') {
       // In prod, we might still want to show ONLY errors in browser if browserLevel allows
       if (priority >= LogLevelPriority[config.browserLevel]) {
         originalConsole[level].apply(console, args);
       }
    } else if (isDevMode() && priority >= LogLevelPriority[config.browserLevel]) {
      originalConsole[level].apply(console, args);
    }

    // Check if should send to server
    if (priority >= LogLevelPriority[config.serverLevel]) {
      sendToServer(level, args);
    }
  } catch (err) {
    if (isDevMode()) originalConsole.error('Logger error:', err);
  }
}

function sendToServer(level: LogLevel, args: any[]) {
  const payload: LogPayload = {
    level,
    message: args
      .map((arg) => {
        try {
          if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
          if (typeof arg === 'object') return JSON.stringify(arg);
          return String(arg);
        } catch {
          return '[Unserializable]';
        }
      })
      .join(' '),
    timestamp: new Date().toISOString(),
  };

  fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/**
 * Intercepts console methods and redirects them to our structured Logger
 */
export function interceptConsole(): void {
  if (typeof window === 'undefined') return;

  const levels: LogLevel[] = ['debug', 'info', 'log', 'warn', 'error'];
  levels.forEach((level) => {
    (console as any)[level] = (...args: any[]) => handleLog(level, args);
  });
}
