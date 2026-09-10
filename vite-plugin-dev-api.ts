import type { IncomingMessage, ServerResponse } from 'node:http';
import { config as loadEnv } from 'dotenv';
import type { Plugin, ViteDevServer } from 'vite';

// Dev-only: mount the Vercel Edge Function at /api/chat during `npm run dev`.
// Vite's dev server doesn't run functions, and installing the full Vercel CLI
// just for local chat is overkill. This adapts Node's req/res to the Web
// `Request`/`Response` the handler expects and streams the SSE body back.
//
// Production is unaffected — Vercel runs api/chat.ts as a real edge function.

export function devApi(): Plugin {
  return {
    name: 'dev-api-chat',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // The handler reads process.env; Vite only exposes VITE_* to the client.
      loadEnv({ path: '.env.local' });

      server.middlewares.use('/api/chat', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const mod = await server.ssrLoadModule('/api/chat.ts');
          const handler = mod.default as (request: Request) => Promise<Response>;

          const body = await readBody(req);
          const request = new Request(`http://localhost${req.url ?? '/api/chat'}`, {
            method: req.method,
            headers: nodeHeadersToWeb(req),
            body: body.length > 0 ? body : undefined,
          });

          const response = await handler(request);

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));

          if (!response.body) {
            res.end();
            return;
          }
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'dev api bridge failed',
            }),
          );
        }
      });
    },
  };
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function nodeHeadersToWeb(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }
  return headers;
}
