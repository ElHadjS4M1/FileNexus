import type { Express } from 'express';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { filesRouter } from './files';
import { meRouter } from './me';
import usersRouter from './users';
import { departmentsRouter } from './departments';
import { projectsRouter } from './projects';

/**
 * Registra todas las rutas HTTP en la instancia de aplicación proporcionada.
 * @param {Express} app - Referencia a la aplicación de Express.
 * @returns {void}
 */
import { Router } from 'express';

// ... imports ...

export const registerRoutes = (app: Express): void => {
  const apiRouter = Router();

  apiRouter.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  apiRouter.use('/admin', adminRouter);
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/files', filesRouter);
  apiRouter.use('/me', meRouter);
  apiRouter.use('/users', usersRouter);
  apiRouter.use('/departments', departmentsRouter);
  apiRouter.use('/projects', projectsRouter);

  // Mount all API routes under /api
  app.use('/api', apiRouter);
};
