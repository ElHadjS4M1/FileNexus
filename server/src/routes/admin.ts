import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { createPendingUser, listUsers } from '../services/userService';
import { prisma } from '../services/prisma';

const createUserSchema = z.object({
  username: z.string().min(3).max(32),
  role: z.enum(['admin', 'dept_head', 'project_head', 'user']),
  password: z.string().min(12),
});

export const adminRouter = Router();

/**
 * Registra la ruta de administración POST /admin/users.
 * @returns {void}
 */
const register = (): void => {
  // Endpoint de estadísticas para el panel
  adminRouter.get(
    '/stats',
    authenticate,
    requireRole(['admin']),
    async (_req, res, next) => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Obtener usuarios creados en los últimos 30 días agrupados por día
        const users = await prisma.user.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });

        // Agrupar por día
        const userGrowth: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
          const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().split('T')[0];
          userGrowth[key] = 0;
        }
        users.forEach(u => {
          const key = u.createdAt.toISOString().split('T')[0];
          if (userGrowth[key] !== undefined) userGrowth[key]++;
        });

        // Últimos 5 usuarios
        const recentUsers = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, username: true, role: true, status: true, createdAt: true },
        });

        // Últimos 5 departamentos
        const recentDepartments = await prisma.department.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { manager: { select: { username: true } } },
        });

        res.json({
          userGrowth: Object.entries(userGrowth).map(([date, count]) => ({ date, count })),
          recentUsers,
          recentDepartments,
          totalUsers: await prisma.user.count(),
          totalDepartments: await prisma.department.count(),
        });
      } catch (error) {
        next(error);
      }
    },
  );

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
