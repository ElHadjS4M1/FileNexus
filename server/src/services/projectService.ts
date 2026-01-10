import { prisma } from './prisma';

/**
 * Create a new project (dept_head only, in their department)
 */
export const createProject = async (
    name: string,
    departmentId: string,
    leaderId: string | undefined,
    creatorId: string
) => {
    // Verify creator is the department manager
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
    });
    if (!department || department.managerId !== creatorId) {
        throw new Error('Solo el jefe de departamento puede crear proyectos');
    }

    // If leaderId is provided, verify leader is a project_head
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
 * Update project leader (dept_head only)
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

    // If assigning a leader, verify they are a project_head
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
 * List projects visible to a user
 */
export const listProjectsForUser = async (userId: string, userRole: string) => {
    // Admin sees all
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

    // Dept head sees projects in their department
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

    // Project head sees projects they lead
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

    // Regular users see projects they're members of OR lead
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
 * Get project by ID with access check
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

    // Check access
    const hasAccess =
        userRole === 'admin' ||
        project.department.managerId === userId ||
        project.leaderId === userId ||
        project.members.some((m) => m.userId === userId);

    if (!hasAccess) return null;

    return project;
};

/**
 * Delete project (dept_head only, in their department)
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
 * Add member to project (project_head only)
 */
export const addProjectMember = async (projectId: string, userId: string, requesterId: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
    });

    if (!project || project.leaderId !== requesterId) {
        throw new Error('Solo el líder del proyecto puede añadir miembros');
    }

    // Verify user exists and is a regular user
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
 * Remove member from project (project_head only)
 */
export const removeProjectMember = async (projectId: string, userId: string, requesterId: string) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
    });

    if (!project || project.leaderId !== requesterId) {
        throw new Error('Solo el líder del proyecto puede eliminar miembros');
    }

    // 1. Remove member
    await prisma.projectMember.delete({
        where: {
            projectId_userId: { projectId, userId },
        },
    });

    // 2. Revoke access to project files
    // Find all files belonging to this project
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
 * Check if user has access to a project
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
