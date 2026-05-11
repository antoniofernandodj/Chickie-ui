import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = Fastify();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Fastify REST API endpoints can be defined here.
 */
app.get('/api/hello', async () => {
  return { message: 'Olá do servidor chickie-ui! 🐣' };
});

app.post('/api/logs', async (request, reply) => {
  const { level, message, timestamp } = request.body as any;
  const ts = timestamp || new Date().toISOString();
  const lvl = (level || 'log').toUpperCase().padEnd(5);
  
  // ANSI Colors
  const colors: Record<string, string> = {
    DEBUG: '\x1b[36m', // Cyan
    INFO:  '\x1b[32m', // Green
    LOG:   '\x1b[37m', // White
    WARN:  '\x1b[33m', // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m',
  };

  const color = colors[lvl.trim()] || colors['LOG'];
  const logMsg = `${colors['RESET']}[${ts}] ${color}${lvl}${colors['RESET']} | ${message}`;

  switch (level) {
    case 'error': console.error(logMsg); break;
    case 'warn':  console.warn(logMsg); break;
    case 'info':  console.info(logMsg); break;
    case 'debug': console.debug(logMsg); break;
    default:      console.log(logMsg);
  }

  return { status: 'ok' };
});

/**
 * Serve static files from /browser
 */
app.register(staticPlugin, {
  root: browserDistFolder,
  wildcard: false,
  index: false,
  maxAge: 31536000000,
});

// The send module writes Cache-Control AFTER the setHeaders callback,
// so the only reliable way to override it for SW files is an onSend hook.
const SW_NO_CACHE_PATHS = new Set(['/ngsw-worker.js', '/ngsw.json', '/safety-worker.js', '/worker-basic.min.js']);
app.addHook('onSend', async (request, reply, payload) => {
  if (SW_NO_CACHE_PATHS.has(request.url)) {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  return payload;
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.setNotFoundHandler(async (request, reply) => {
  const response = await angularApp.handle(request.raw);
  if (response) {
    await writeResponseToNodeResponse(response, reply.raw);
  }
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 4000);
  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) throw err;
    console.log(`Fastify server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(async (req, res) => {
  await app.ready();
  app.server.emit('request', req, res);
});
