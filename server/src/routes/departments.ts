import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { HttpError } from '../utils/httpError';
import { prisma } from '../services/prisma';
import {
    createDepartment,
    listDepartments,
    getDepartmentById,
    deleteDepartment,
    updateDepartmentManager,
} from '../services/departmentService';

const router = Router();

router.use(authenticate);

// Estadísticas para el panel de dept_head
router.get('/stats', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'dept_head') {
            throw new HttpError(403, 'Solo dept_head puede acceder');
        }

        // Obtener el departamento gestionado por este usuario
        const department = await prisma.department.findUnique({
            where: { managerId: req.authUser.id },
        });

        if (!department) {
            return res.json({
                projectGrowth: [],
                recentProjects: [],
                recentFiles: [],
                totalProjects: 0,
                totalFiles: 0,
                departmentName: null,
            });
        }

        const now = new Date();
        const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

        // Obtener proyectos en este departamento creados en los últimos 30 días (incluyendo hoy)
        const projects = await prisma.project.findMany({
            where: {
                departmentId: department.id,
                createdAt: { gte: twentyNineDaysAgo }
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Agrupar por día (hace 29 días hasta hoy = 30 días)
        const projectGrowth: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
            const d = new Date(twentyNineDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().split('T')[0];
            projectGrowth[key] = 0;
        }
        projects.forEach((p: { createdAt: Date }) => {
            const key = p.createdAt.toISOString().split('T')[0];
            if (projectGrowth[key] !== undefined) projectGrowth[key]++;
        });

        // Últimos 5 proyectos en el departamento
        const recentProjects = await prisma.project.findMany({
            where: { departmentId: department.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { leader: { select: { username: true } } },
        });

        // Obtener IDs de proyectos en este departamento
        const projectIds = (await prisma.project.findMany({
            where: { departmentId: department.id },
            select: { id: true },
        })).map((p: { id: string }) => p.id);

        // Últimos 5 archivos: propiedad del dept_head O en proyectos del departamento
        const recentFiles = await prisma.file.findMany({
            where: {
                OR: [
                    { ownerId: req.authUser.id },
                    ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { owner: { select: { username: true } } },
        });

        const totalProjects = await prisma.project.count({
            where: { departmentId: department.id },
        });

        const totalFiles = await prisma.file.count({
            where: {
                OR: [
                    { ownerId: req.authUser.id },
                    ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
                ],
            },
        });

        res.json({
            projectGrowth: Object.entries(projectGrowth).map(([date, count]) => ({ date, count })),
            recentProjects,
            recentFiles,
            totalProjects,
            totalFiles,
            departmentName: department.name,
        });
    } catch (error) {
        next(error);
    }
});

// Crear departamento (solo admin) - el jefe es opcional
router.post('/', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'admin') {
            throw new HttpError(403, 'Solo el administrador puede crear departamentos');
        }

        const { name, managerId } = req.body;
        if (!name) {
            throw new HttpError(400, 'name es requerido');
        }

        const department = await createDepartment(name, managerId || undefined);
        res.status(201).json(department);
    } catch (error) {
        next(error);
    }
});

// Listar departamentos
router.get('/', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const departments = await listDepartments(req.authUser.id, req.authUser.role);
        res.json({ departments });
    } catch (error) {
        next(error);
    }
});

// Obtener departamento por ID
router.get('/:id', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const department = await getDepartmentById(req.params.id);
        if (!department) {
            throw new HttpError(404, 'Departamento no encontrado');
        }

        // Verificar acceso
        if (req.authUser.role !== 'admin' && department.managerId !== req.authUser.id) {
            throw new HttpError(403, 'No tienes acceso a este departamento');
        }

        res.json(department);
    } catch (error) {
        next(error);
    }
});

// Actualizar jefe de departamento (solo admin)
router.patch('/:id', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'admin') {
            throw new HttpError(403, 'Solo el administrador puede modificar departamentos');
        }

        const { managerId } = req.body;
        const department = await updateDepartmentManager(req.params.id, managerId);
        res.json(department);
    } catch (error) {
        next(error);
    }
});

// Eliminar departamento (solo admin)
router.delete('/:id', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'admin') {
            throw new HttpError(403, 'Solo el administrador puede eliminar departamentos');
        }

        await deleteDepartment(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export const departmentsRouter = router;
