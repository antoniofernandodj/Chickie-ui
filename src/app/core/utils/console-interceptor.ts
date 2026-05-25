import { LogLevel, LogLevelPriority, LogPayload } from '../models';
import { isDevMode } from '@angular/core';
import { environment } from '../../../environments/environment';
import { encryptLogPayload, clearPublicKeyCache } from './log-crypto';

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
//
// Rotação de chaves: se o servidor retornar 400 (invalid_payload), o cliente
// invalida todos os caches e busca a nova chave pública antes de reenviar.

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

/**
 * Descarta todos os caches da chave pública (memória, CryptoKey e localStorage).
 * Chamado quando o servidor retorna 400 invalid_payload — indica que as chaves
 * foram rotacionadas (ex.: reinicialização do servidor).
 */
function invalidatePublicKeyCache(): void {
  _cachedKey    = null;
  _fetchPromise = null;
  clearPublicKeyCache(); // descarta a CryptoKey importada em log-crypto.ts
  try { localStorage.removeItem(LOG_PK_LS_KEY); } catch { /* ignore */ }
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

  // Tenta enviar o log encriptado; em caso de 400 (invalid_payload) invalida o
  // cache de chaves e retenta uma única vez com a nova chave pública do servidor.
  for (let attempt = 0; attempt < 2; attempt++) {
    const publicKey = await getPublicKey();
    if (!publicKey) return; // servidor indisponível — descarta silenciosamente

    let res: Response | undefined;
    try {
      const encrypted = await encryptLogPayload(payload, publicKey);
      res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encrypted),
      });
    } catch {
      // Erro de rede ou criptografia — descarta sem vazar em plaintext
      return;
    }

    if (res.ok) return; // sucesso ✓

    if (res.status === 400) {
      // Servidor não conseguiu decriptar → chaves foram rotacionadas.
      // Invalida todos os caches e busca a nova chave na próxima iteração.
      invalidatePublicKeyCache();
      continue;
    }

    return; // outro erro HTTP — não retenta
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
