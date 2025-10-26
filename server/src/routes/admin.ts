import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { createPendingUser, listUsers } from '../services/userService';

const createUserSchema = z.object({
  username: z.string().min(3).max(32),
  role: z.enum(['admin', 'dept_head', 'project_head', 'user']),
  password: z.string().min(12),
});

export const adminRouter = Router();

/**
 * Registers the admin POST /admin/users route.
 * @returns {void}
 */
const register = (): void => {
  adminRouter.get(
    '/users',
    authenticate,
    requireRole(['admin']),
    async (_req, res, next) => {
      try {
        const users = await listUsers();
        res.json({ users });
      } catch (error) {
        next(error);
      }
    },
  );

  adminRouter.post(
    '/users',
    authenticate,
    requireRole(['admin']),
    async (req, res, next) => {
      try {
        const payload = createUserSchema.parse(req.body);
        const user = await createPendingUser(payload);
        res.status(201).json({
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        });
      } catch (error) {
        next(error);
      }
    },
  );
};

register();
