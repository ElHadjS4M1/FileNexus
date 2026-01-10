import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { buildCors, buildHelmet, buildRateLimiter } from './middleware/security';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './logger';
import { registerRoutes } from './routes';

/**
 * Configura y devuelve una instancia de aplicación de Express.
 * @returns {express.Express} Aplicación de Express completamente integrada.
 */
export const createApp = (): express.Express => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(buildHelmet());
  app.use(buildCors());
  app.use(buildRateLimiter());
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));

  registerRoutes(app);

  // Serve static files from client/dist
  const clientDistPath = path.join(__dirname, '../../client/dist');
  logger.info({ clientDistPath }, 'Serving static files from path');

  // Debug: List files in clientDistPath
  import('fs').then(fs => {
    fs.readdir(clientDistPath, (err, files) => {
      if (err) {
        logger.error({ err }, 'Failed to list client dist files');
      } else {
        logger.info({ files }, 'Files in client dist');
      }
    });
  });

  app.use(express.static(clientDistPath));

  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.accepts('html')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
      next();
    }
  });

  // 404 Handler
  app.use((req, res) => {
    logger.warn({ url: req.url }, 'Route not found');
    res.status(404).json({ error: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
};
