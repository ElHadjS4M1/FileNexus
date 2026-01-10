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
export const registerRoutes = (app: Express): void => {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/admin', adminRouter);
  app.use('/auth', authRouter);
  app.use('/files', filesRouter);
  app.use('/me', meRouter);
  app.use('/users', usersRouter);
  app.use('/departments', departmentsRouter);
  app.use('/projects', projectsRouter);
};
