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
  // Use path.resolve for absolute path resolution relative to this file
  // src/app.ts -> ../../client/dist
  const clientDistPath = path.resolve(__dirname, '../../client/dist');

  logger.info({ clientDistPath, cwd: process.cwd() }, 'Configuring static file serving');

  app.use(express.static(clientDistPath));

  // Debug endpoint to check deployment paths
  app.get('/api/debug/deployment', (req, res) => {
    const fs = require('fs');
    let files: string[] = [];
    let error: string | undefined;

    try {
      if (fs.existsSync(clientDistPath)) {
        files = fs.readdirSync(clientDistPath);
      } else {
        error = 'Directory does not exist';
      }
    } catch (e: any) {
      error = e.message;
    }

    res.json({
      cwd: process.cwd(),
      __dirname,
      clientDistPath,
      files,
      error,
      env: process.env.NODE_ENV
    });
  });

  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.accepts('html')) {
      const indexPath = path.join(clientDistPath, 'index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // If index.html doesn't exist, we can't serve the SPA. 
        // Fall through to 404 to avoid confusing MIME type errors.
        next();
      }
    } else {
      next();
    }
  });

  // 404 Handler
  app.use((req, res) => {
    // If we got here, it's a 404.
    // If it was a request for assets (js/css), return 404.
    logger.warn({ url: req.url }, 'Route not found');
    res.status(404).json({ error: 'Not Found', path: req.url });
  });

  app.use(errorHandler);

  return app;
};
