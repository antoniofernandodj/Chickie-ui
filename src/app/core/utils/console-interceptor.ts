import { LogLevel, LogLevelPriority, LogPayload } from '../models';
import { isDevMode } from '@angular/core';
import { environment } from '../../../environments/environment';
import { encryptLogPayload } from './log-crypto';

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

// ─── Public key — cache-aside ─────────────────────────────────────────────────
// Ordem de busca: memória → localStorage → servidor.
// O servidor gera/persiste a chave automaticamente no startup (server-keys.json).
// Zero chaves no bundle ou no repositório.

const LOG_PK_LS_KEY = '__log_pk__';

let _cachedKey: string | null = null;    // memória (mais rápido, dura a sessão)
let _fetchPromise: Promise<string | null> | null = null; // evita requests paralelos

function getPublicKey(): Promise<string | null> {
  // 1. Memória
  if (_cachedKey) return Promise.resolve(_cachedKey);

  // 2. Fetch em andamento — aguarda o mesmo
  if (_fetchPromise) return _fetchPromise;

  // 3. localStorage (persiste entre refreshes)
  try {
    const stored = localStorage.getItem(LOG_PK_LS_KEY);
    if (stored) {
      _cachedKey = stored;
      return Promise.resolve(_cachedKey);
    }
  } catch { /* SSR ou modo privado com restrições */ }

  // 4. Busca no servidor e popula os dois caches
  _fetchPromise = fetch('/api/logs/public-key')
    .then((res) => res.json())
    .then((data) => {
      const key = (data as any).publicKey as string;
      _cachedKey = key;
      try { localStorage.setItem(LOG_PK_LS_KEY, key); } catch { /* ignore */ }
      return key;
    })
    .catch(() => null)
    .finally(() => { _fetchPromise = null; });

  return _fetchPromise;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

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

async function sendToServer(level: LogLevel, args: any[]) {
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

  // Busca a public key do servidor (cacheada após a primeira chamada)
  const publicKey = await getPublicKey();
  if (!publicKey) return; // servidor indisponível ou erro — descarta silenciosamente

  try {
    const encrypted = await encryptLogPayload(payload, publicKey);
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encrypted),
    }).catch(() => {});
  } catch {
    // Criptografia falhou (browser muito antigo?) — descarta sem vazar em plaintext
  }
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
