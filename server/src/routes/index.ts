import type { Express } from 'express';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { filesRouter } from './files';
import { meRouter } from './me';

/**
 * Registers all HTTP routes on the provided application instance.
 * @param {Express} app - Express app reference.
 * @returns {void}
 */
export const registerRoutes = (app: Express): void => {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/admin', adminRouter);
  app.use('/auth', authRouter);
  app.use('/files', filesRouter);
  app.use('/me', meRouter);
};
