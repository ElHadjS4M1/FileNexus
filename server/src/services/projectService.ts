import { prisma } from './prisma';

/**
 * Crear un nuevo proyecto (solo dept_head, en su departamento)
 */
export const createProject = async (
    name: string,
    departmentId: string,
    leaderId: string | undefined,
    creatorId: string
) => {
    // Verificar que el creador es el jefe del departamento
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
    });
    if (!department || department.managerId !== creatorId) {
        throw new Error('Solo el jefe de departamento puede crear proyectos');
    }

    // Si se proporciona leaderId, verificar que el líder sea un project_head
    if (leaderId) {
        const leader = await prisma.user.findUnique({
            where: { id: leaderId },
        });
        if (!leader || leader.role !== 'project_head') {
            throw new Error('El líder debe tener rol project_head');
        }
    }

    return prisma.project.create({
        data: {
            name,
            departmentId,
            leaderId: leaderId || null,
        },
        include: {
            leader: { select: { id: true, username: true } },
            department: { select: { id: true, name: true } },
        },
    });
};

/**
 * Actualizar líder del proyecto (solo dept_head)
 */
export const updateProjectLeader = async (
    projectId: string,
    leaderId: string | null,
    userId: string
) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { department: true },
    });

    if (!project || project.department.managerId !== userId) {
        throw new Error('Solo el jefe de departamento puede asignar líderes');
    }

    // Si se asigna un líder, verificar que sea un project_head
    if (leaderId) {
        const leader = await prisma.user.findUnique({
            where: { id: leaderId },
        });
        if (!leader || leader.role !== 'project_head') {
            throw new Error('El líder debe tener rol project_head');
        }
    }

    return prisma.project.update({
        where: { id: projectId },
        data: { leaderId },
        include: {
            leader: { select: { id: true, username: true } },
            department: { select: { id: true, name: true } },
        },
    });
};

/**
 * Listar proyectos visibles para un usuario
 */
export const listProjectsForUser = async (userId: string, userRole: string) => {
    // Admin ve todo
    if (userRole === 'admin') {
        return prisma.project.findMany({
            include: {
                leader: { select: { id: true, username: true } },
                department: { select: { id: true, name: true } },
                _count: { select: { members: true, files: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    // Jefe de departamento ve proyectos en su departamento
    if (userRole === 'dept_head') {
        const dept = await prisma.department.findUnique({
            where: { managerId: userId },
        });
        if (!dept) return [];
        return prisma.project.findMany({
            where: { departmentId: dept.id },
            include: {
                leader: { select: { id: true, username: true } },
                department: { select: { id: true, name: true } },
                _count: { select: { members: true, files: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    // Líder de proyecto ve proyectos que lidera
    if (userRole === 'project_head') {
        return prisma.project.findMany({
            where: { leaderId: userId },
            include: {
                leader: { select: { id: true, username: true } },
                department: { select: { id: true, name: true } },
                _count: { select: { members: true, files: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    // Usuarios regulares ven proyectos de los que son miembros O lideran
    return prisma.project.findMany({
        where: {
            OR: [
                { members: { some: { userId } } },
                { leaderId: userId },
            ],
        },
        include: {
            leader: { select: { id: true, username: true } },
            department: { select: { id: true, name: true } },
            _count: { select: { members: true, files: true } },
        },
        orderBy: { name: 'asc' },
    });
};

/**
 * Obtener proyecto por ID con verificación de acceso
 */
export const getProjectForUser = async (projectId: string, userId: string, userRole: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            leader: { select: { id: true, username: true } },
            department: { select: { id: true, name: true, managerId: true } },
            members: {
                include: {
                    user: { select: { id: true, username: true, role: true } },
                },
            },
        },
    });

    if (!project) return null;

    // Verificar acceso
    const hasAccess =
        userRole === 'admin' ||
        project.department.managerId === userId ||
        project.leaderId === userId ||
        project.members.some((m) => m.userId === userId);

    if (!hasAccess) return null;

    return project;
};

/**
 * Eliminar proyecto (solo dept_head, en su departamento)
 */
export const deleteProject = async (projectId: string, userId: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { department: true },
    });

    if (!project || project.department.managerId !== userId) {
        throw new Error('Solo el jefe de departamento puede eliminar proyectos');
    }

    return prisma.project.delete({
        where: { id: projectId },
    });
};

/**
 * Añadir miembro al proyecto (solo project_head)
 */
export const addProjectMember = async (projectId: string, userId: string, requesterId: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
    });

    if (!project || project.leaderId !== requesterId) {
        throw new Error('Solo el líder del proyecto puede añadir miembros');
    }

    // Verificar que el usuario existe y es un usuario regular
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user || user.role !== 'user') {
        throw new Error('Solo se pueden añadir usuarios con rol user');
    }

    return prisma.projectMember.create({
        data: {
            projectId,
            userId,
        },
        include: {
            user: { select: { id: true, username: true } },
        },
    });
};

/**
 * Eliminar miembro del proyecto (solo project_head)
 */
export const removeProjectMember = async (projectId: string, userId: string, requesterId: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
    });

    if (!project || project.leaderId !== requesterId) {
        throw new Error('Solo el líder del proyecto puede eliminar miembros');
    }

    // Eliminar miembro
    await prisma.projectMember.delete({
        where: {
            projectId_userId: { projectId, userId },
        },
    });

    // Revocar acceso a archivos del proyecto
    const projectFiles = await prisma.file.findMany({
        where: { projectId },
        select: { id: true },
    });

    const fileIds = projectFiles.map(f => f.id);

    if (fileIds.length > 0) {
        await prisma.fileShare.deleteMany({
            where: {
                userId,
                fileId: { in: fileIds },
            },
        });
    }

    return { success: true };
};

/**
 * Verificar si el usuario tiene acceso a un proyecto
 */
export const userHasProjectAccess = async (projectId: string, userId: string, userRole: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            department: { select: { managerId: true } },
            members: { select: { userId: true } },
        },
    });

    if (!project) return false;

    return (
        userRole === 'admin' ||
        project.department.managerId === userId ||
        project.leaderId === userId ||
        project.members.some((m) => m.userId === userId)
    );
};
