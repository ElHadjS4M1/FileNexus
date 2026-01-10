import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { HttpError } from '../utils/httpError';
import {
    createProject,
    listProjectsForUser,
    getProjectForUser,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    updateProjectLeader,
} from '../services/projectService';
import { prisma } from '../services/prisma';

const router = Router();

router.use(authenticate);

// Estadísticas para el panel de project_head
router.get('/stats', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'project_head') {
            throw new HttpError(403, 'Solo project_head puede acceder');
        }

        // Obtener el proyecto liderado por este usuario
        const project = await prisma.project.findFirst({
            where: { leaderId: req.authUser.id },
        });

        if (!project) {
            return res.json({
                fileGrowth: [],
                recentMembers: [],
                recentFiles: [],
                totalMembers: 0,
                totalFiles: 0,
                projectName: null,
            });
        }

        const now = new Date();
        const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

        // Obtener archivos en este proyecto O propiedad del project_head creados en los últimos 30 días (incluyendo hoy)
        const files = await prisma.file.findMany({
            where: {
                OR: [
                    { projectId: project.id },
                    { ownerId: req.authUser.id },
                ],
                createdAt: { gte: twentyNineDaysAgo }
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Agrupar por día
        const fileGrowth: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
            const d = new Date(twentyNineDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().split('T')[0];
            fileGrowth[key] = 0;
        }
        files.forEach((f: { createdAt: Date }) => {
            const key = f.createdAt.toISOString().split('T')[0];
            if (fileGrowth[key] !== undefined) fileGrowth[key]++;
        });

        // Últimos 5 miembros añadidos al proyecto
        const recentMembers = await prisma.projectMember.findMany({
            where: { projectId: project.id },
            orderBy: { id: 'desc' },
            take: 5,
            include: { user: { select: { id: true, username: true, role: true } } },
        });

        // Últimos 5 archivos: en el proyecto O propiedad del project_head
        const recentFiles = await prisma.file.findMany({
            where: {
                OR: [
                    { projectId: project.id },
                    { ownerId: req.authUser.id },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { owner: { select: { username: true } } },
        });

        const totalMembers = await prisma.projectMember.count({
            where: { projectId: project.id },
        });

        const totalFiles = await prisma.file.count({
            where: {
                OR: [
                    { projectId: project.id },
                    { ownerId: req.authUser.id },
                ],
            },
        });

        res.json({
            fileGrowth: Object.entries(fileGrowth).map(([date, count]) => ({ date, count })),
            recentMembers: recentMembers.map(m => ({ ...m.user, joinedAt: m.id })),
            recentFiles,
            totalMembers,
            totalFiles,
            projectName: project.name,
        });
    } catch (error) {
        next(error);
    }
});

// Crear proyecto (solo dept_head) - leaderId es opcional
router.post('/', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'dept_head') {
            throw new HttpError(403, 'Solo jefes de departamento pueden crear proyectos');
        }

        const { name, departmentId, leaderId } = req.body;
        if (!name || !departmentId) {
            throw new HttpError(400, 'name y departmentId son requeridos');
        }

        const project = await createProject(name, departmentId, leaderId || undefined, req.authUser.id);
        res.status(201).json(project);
    } catch (error) {
        next(error);
    }
});

// Actualizar líder del proyecto (solo dept_head)
router.patch('/:id', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'dept_head') {
            throw new HttpError(403, 'Solo jefes de departamento pueden asignar líderes');
        }

        const { leaderId } = req.body;
        const project = await updateProjectLeader(req.params.id, leaderId || null, req.authUser.id);
        res.json(project);
    } catch (error) {
        next(error);
    }
});

// Listar proyectos para el usuario actual
router.get('/', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const projects = await listProjectsForUser(req.authUser.id, req.authUser.role);
        res.json({ projects });
    } catch (error) {
        next(error);
    }
});

// Obtener proyecto por ID
router.get('/:id', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const project = await getProjectForUser(req.params.id, req.authUser.id, req.authUser.role);
        if (!project) {
            throw new HttpError(404, 'Proyecto no encontrado');
        }

        res.json(project);
    } catch (error) {
        next(error);
    }
});

// Eliminar proyecto (solo dept_head)
router.delete('/:id', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        await deleteProject(req.params.id, req.authUser.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// ============ MIEMBROS ============

// Listar miembros del proyecto
router.get('/:id/members', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const project = await getProjectForUser(req.params.id, req.authUser.id, req.authUser.role);
        if (!project) {
            throw new HttpError(404, 'Proyecto no encontrado');
        }

        res.json({ members: project.members });
    } catch (error) {
        next(error);
    }
});

// Añadir miembro al proyecto (solo project_head)
router.post('/:id/members', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const { userId } = req.body;
        if (!userId) {
            throw new HttpError(400, 'userId es requerido');
        }

        const member = await addProjectMember(req.params.id, userId, req.authUser.id);
        res.status(201).json(member);
    } catch (error) {
        next(error);
    }
});

// Obtener claves públicas de todos los miembros del proyecto para cifrado multi-destinatario
router.get('/:id/members/keys', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                leader: { select: { id: true, username: true, publicKeyJwk: true } },
                members: {
                    include: {
                        user: { select: { id: true, username: true, publicKeyJwk: true } }
                    }
                },
            },
        });

        if (!project) {
            throw new HttpError(404, 'Project not found');
        }

        // Verificar que el usuario tiene acceso a este proyecto
        const isMember = project.leaderId === req.authUser.id ||
            project.members.some((m: { userId: string }) => m.userId === req.authUser!.id);
        if (!isMember) {
            throw new HttpError(403, 'No tienes acceso a este proyecto');
        }

        // Recopilar claves públicas de todos los miembros (líder + miembros, excluyendo solicitante)
        const recipients: { id: string; username: string; publicKeyJwk: unknown }[] = [];

        if (project.leader && project.leader.id !== req.authUser.id && project.leader.publicKeyJwk) {
            const storedKey = project.leader.publicKeyJwk as Record<string, unknown>;
            recipients.push({
                id: project.leader.id,
                username: project.leader.username,
                publicKeyJwk: storedKey?.jwk || storedKey,
            });
        }

        project.members.forEach((m: { user: { id: string; username: string; publicKeyJwk: unknown } }) => {
            if (m.user.id !== req.authUser!.id && m.user.publicKeyJwk) {
                const storedKey = m.user.publicKeyJwk as Record<string, unknown>;
                recipients.push({
                    id: m.user.id,
                    username: m.user.username,
                    publicKeyJwk: storedKey?.jwk || storedKey,
                });
            }
        });

        res.json({ recipients });
    } catch (error) {
        next(error);
    }
});

// Eliminar miembro del proyecto (solo project_head)
router.delete('/:id/members/:userId', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        await removeProjectMember(req.params.id, req.params.userId, req.authUser.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export const projectsRouter = router;
