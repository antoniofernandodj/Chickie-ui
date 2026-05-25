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
  constants,
} from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// ─── RSA Keys ────────────────────────────────────────────────────────────────
// Gerado automaticamente no primeiro startup. Persiste entre reinicializações.
// O arquivo é ignorado pelo git (server-keys.json está no .gitignore).

interface LogKeys {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateKeys(): LogKeys {
  // Prioridade de path:
  //   1. Variável de ambiente LOG_KEYS_PATH (produção/deploy customizado)
  //   2. Dois níveis acima do arquivo compilado (project root em dist/chickie-ui/server/)
  //      → dist/chickie-ui/server/../../  = dist/chickie-ui/ … ainda dentro de dist
  //   3. process.cwd() como fallback final (compatível com `npm run serve:ssr`)
  const keysPath = process.env['LOG_KEYS_PATH']
    ? resolve(process.env['LOG_KEYS_PATH'])
    : (() => {
        // import.meta.dirname aponta para o diretório do bundle compilado.
        // Subimos até o project-root tentando encontrar package.json.
        let dir = import.meta.dirname;
        for (let i = 0; i < 5; i++) {
          const candidate = join(dir, 'server-keys.json');
          const pkgJson   = join(dir, 'package.json');
          // Para quando encontrar o package.json (project root) ou o arquivo já existir
          if (existsSync(candidate)) return candidate;
          if (existsSync(pkgJson))   return candidate; // usa este diretório
          dir = resolve(dir, '..');
        }
        return join(process.cwd(), 'server-keys.json'); // fallback
      })();

  if (existsSync(keysPath)) {
    console.log(`[logs] Chaves RSA carregadas de ${keysPath}`);
    try {
      return JSON.parse(readFileSync(keysPath, 'utf8')) as LogKeys;
    } catch {
      console.warn(`[logs] Arquivo de chaves corrompido — regenerando em ${keysPath}`);
    }
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const keys: LogKeys = { publicKey, privateKey };
  try {
    writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
    console.log(`[logs] Par de chaves RSA gerado → ${keysPath}`);
  } catch (err) {
    // Sem permissão de escrita — chaves ficam só em memória (ok para dev/test)
    console.warn(`[logs] Não foi possível persistir chaves em ${keysPath}: ${(err as Error).message}`);
    console.warn('[logs] As chaves serão regeneradas no próximo restart (clientes precisarão buscar nova PK)');
  }

  return keys;
}

const { publicKey: LOG_PUBLIC_KEY, privateKey: LOG_PRIVATE_KEY_PEM } = loadOrCreateKeys();

// ─── Server ───────────────────────────────────────────────────────────────────

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = Fastify();
const angularApp = new AngularNodeAppEngine();

app.get('/api/hello', async () => {
  return { message: 'Olá do servidor chickie-ui! 🐣' };
});

// Expõe a public key para o cliente criptografar os logs em runtime
app.get('/api/logs/public-key', async () => {
  return { publicKey: LOG_PUBLIC_KEY };
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

function decryptLogPayload(body: any): { level: string; message: string; timestamp: string } {
  const privateKey = createPrivateKey(LOG_PRIVATE_KEY_PEM);

  // 1. Decripta a chave AES efêmera com a RSA private key
  const aesKeyBuffer = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(body.encryptedKey, 'base64'),
  );

  // 2. Decripta o payload com AES-GCM
  //    Web Crypto API concatena o auth tag (16 bytes) ao final do ciphertext
  const ivBuffer     = Buffer.from(body.iv, 'base64');
  const encryptedBuf = Buffer.from(body.encryptedData, 'base64');
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
      console.error('[logs] Falha ao decriptar payload:', (err as Error).message);
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
