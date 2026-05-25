import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { join, resolve } from 'node:path';
import {
  generateKeyPairSync,
  privateDecrypt,
  createDecipheriv,
  createPrivateKey,
  createHash,
  constants,
} from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// ─── RSA Keys ────────────────────────────────────────────────────────────────
// Prioridade:
//   1. Variáveis de ambiente FRONTEND_PUBLIC_KEY + FRONTEND_PRIVATE_KEY (produção/Dokploy)
//   2. Arquivo server-keys.json no project root (dev local)
//   3. Geração automática em memória (fallback — chaves duram só a sessão)

interface LogKeys {
  publicKey: string;
  privateKey: string;
}

/** Normaliza PEM: o Dokploy pode armazenar \n como literal "\\n" na env var. */
function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

function loadOrCreateKeys(): LogKeys {
  // 1. Env vars (Dokploy / produção) — fonte canônica, não regenera nunca
  const envPublic  = process.env['FRONTEND_PUBLIC_KEY'];
  const envPrivate = process.env['FRONTEND_PRIVATE_KEY'];
  if (envPublic && envPrivate) {
    console.log('[logs] Chaves RSA carregadas das variáveis de ambiente');
    return { publicKey: normalizePem(envPublic), privateKey: normalizePem(envPrivate) };
  }

  // 2. Arquivo local (dev) — persiste entre restarts sem precisar de env vars
  const keysPath = (() => {
    let dir = import.meta.dirname;
    for (let i = 0; i < 5; i++) {
      const candidate = join(dir, 'server-keys.json');
      if (existsSync(candidate)) return candidate;
      if (existsSync(join(dir, 'package.json'))) return candidate;
      dir = resolve(dir, '..');
    }
    return join(process.cwd(), 'server-keys.json');
  })();

  if (existsSync(keysPath)) {
    console.log(`[logs] Chaves RSA carregadas de ${keysPath}`);
    try {
      return JSON.parse(readFileSync(keysPath, 'utf8')) as LogKeys;
    } catch {
      console.warn(`[logs] Arquivo de chaves corrompido — regenerando em ${keysPath}`);
    }
  }

  // 3. Gera novo par e tenta persistir localmente
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  try {
    writeFileSync(keysPath, JSON.stringify({ publicKey, privateKey }, null, 2), { mode: 0o600 });
    console.log(`[logs] Par de chaves RSA gerado → ${keysPath}`);
  } catch (err) {
    console.warn(`[logs] Não foi possível persistir chaves: ${(err as Error).message}`);
    console.warn('[logs] Configure FRONTEND_PUBLIC_KEY + FRONTEND_PRIVATE_KEY para evitar rotação no restart');
  }

  return { publicKey, privateKey };
}

const { publicKey: LOG_PUBLIC_KEY, privateKey: LOG_PRIVATE_KEY_PEM } = loadOrCreateKeys();

/** Fingerprint curto da chave pública (12 hex chars = 48 bits). Usado pelo cliente
 *  para detectar rotação de chaves sem precisar tentar decriptar. */
const LOG_KEY_ID = createHash('sha256').update(LOG_PUBLIC_KEY).digest('hex').slice(0, 12);

// ─── Server ───────────────────────────────────────────────────────────────────

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = Fastify();
const angularApp = new AngularNodeAppEngine();

app.get('/api/hello', async () => {
  return { message: 'Olá do servidor chickie-ui! 🐣' };
});

// Expõe a public key (+ fingerprint) para o cliente criptografar os logs em runtime
app.get('/api/logs/public-key', async () => {
  return { publicKey: LOG_PUBLIC_KEY, keyId: LOG_KEY_ID };
});

// ─── Logging ──────────────────────────────────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  DEBUG: '\x1b[36m', // Cyan
  INFO:  '\x1b[32m', // Green
  LOG:   '\x1b[37m', // White
  WARN:  '\x1b[33m', // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m',
};

function printLog(level: string, message: string, timestamp: string) {
  const ts    = timestamp || new Date().toISOString();
  const lvl   = (level || 'log').toUpperCase().padEnd(5);
  const color = LOG_COLORS[lvl.trim()] ?? LOG_COLORS['LOG'];
  const msg   = `${LOG_COLORS['RESET']}[${ts}] ${color}${lvl}${LOG_COLORS['RESET']} | ${message}`;

  switch (level) {
    case 'error': console.error(msg); break;
    case 'warn':  console.warn(msg);  break;
    case 'info':  console.info(msg);  break;
    case 'debug': console.debug(msg); break;
    default:      console.log(msg);
  }
}

/** Erro lançado quando o payload foi encriptado com uma chave antiga (rotação). */
class KeyRotationError extends Error {
  constructor() { super('key_rotation'); this.name = 'KeyRotationError'; }
}

function decryptLogPayload(body: any): { level: string; message: string; timestamp: string } {
  // 0. Checa o fingerprint da chave antes de tentar decriptar.
  //    Se o cliente enviou um keyId diferente do atual, a chave foi rotacionada
  //    (servidor reiniciou sem persistência, por ex.) — não é um erro real.
  if (typeof body.keyId === 'string' && body.keyId !== LOG_KEY_ID) {
    throw new KeyRotationError();
  }

  const privateKey = createPrivateKey(LOG_PRIVATE_KEY_PEM);

  // 1. Valida o tamanho de encryptedKey (RSA-2048 sempre produz exatamente 256 bytes)
  const encKeyBuf = Buffer.from(body.encryptedKey as string, 'base64');
  if (encKeyBuf.length !== 256) {
    // Tamanho errado → cliente usou chave de tamanho diferente (provavelmente rotação)
    throw new KeyRotationError();
  }

  // 2. Decripta a chave AES efêmera com a RSA private key
  const aesKeyBuffer = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    encKeyBuf,
  );

  // 3. Decripta o payload com AES-GCM
  //    Web Crypto API concatena o auth tag (16 bytes) ao final do ciphertext
  const ivBuffer     = Buffer.from(body.iv as string, 'base64');
  const encryptedBuf = Buffer.from(body.encryptedData as string, 'base64');
  const authTag      = encryptedBuf.subarray(encryptedBuf.length - 16);
  const ciphertext   = encryptedBuf.subarray(0, encryptedBuf.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', aesKeyBuffer, ivBuffer);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

app.post('/api/logs', async (request, reply) => {
  const body = request.body as any;
  let level: string, message: string, timestamp: string;

  if (body.encrypted === true) {
    try {
      ({ level, message, timestamp } = decryptLogPayload(body));
    } catch (err) {
      if (err instanceof KeyRotationError) {
        // Esperado: cliente usou chave antiga após reinício do servidor.
        // O cliente buscará a nova chave e reenviará automaticamente.
      } else {
        // Falha real de decriptação — payload corrompido ou bug no cliente.
        console.error('[logs] Falha ao decriptar payload:', (err as Error).message);
      }
      return reply.code(400).send({ error: 'invalid_payload' });
    }
  } else {
    ({ level, message, timestamp } = body);
  }

  printLog(level, message, timestamp);
  return { status: 'ok' };
});

// ─── Static + SSR ─────────────────────────────────────────────────────────────

app.register(staticPlugin, {
  root: browserDistFolder,
  wildcard: false,
  index: false,
  maxAge: 31536000000,
});

const SW_NO_CACHE_PATHS = new Set(['/ngsw-worker.js', '/ngsw.json', '/safety-worker.js', '/worker-basic.min.js']);
app.addHook('onSend', async (request, reply, payload) => {
  if (SW_NO_CACHE_PATHS.has(request.url)) {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  return payload;
});

app.setNotFoundHandler(async (request, reply) => {
  const response = await angularApp.handle(request.raw);
  if (response) {
    await writeResponseToNodeResponse(response, reply.raw);
  }
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 4000);
  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) throw err;
    console.log(`Fastify server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(async (req, res) => {
  await app.ready();
  app.server.emit('request', req, res);
});
