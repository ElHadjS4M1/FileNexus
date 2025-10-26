import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createApp } from './app';
import { appEnv } from './config/env';
import { logger } from './logger';
import { registerPrismaShutdown } from './services/prisma';

/**
 * Boots the HTTP(S) server with the configured options.
 * @returns {void}
 */
const start = (): void => {
  const app = createApp();
  registerPrismaShutdown();

  const listener =
    appEnv.TLS_CERT_PATH && appEnv.TLS_KEY_PATH
      ? https.createServer(
          {
            key: readFileSync(appEnv.TLS_KEY_PATH),
            cert: readFileSync(appEnv.TLS_CERT_PATH),
          },
          app,
        )
      : http.createServer(app);

  listener.listen(appEnv.PORT, () => {
    const protocol = appEnv.TLS_CERT_PATH && appEnv.TLS_KEY_PATH ? 'https' : 'http';
    logger.info(`Server listening on ${protocol}://localhost:${appEnv.PORT}`);
  });
};

start();
