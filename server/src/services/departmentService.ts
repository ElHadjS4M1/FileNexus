import { prisma } from './prisma';

/**
 * Create a new department (admin only)
 * Manager is optional - can be assigned later
 */
export const createDepartment = async (name: string, managerId?: string) => {
    // If manager provided, verify they are a dept_head
    if (managerId) {
        const manager = await prisma.user.findUnique({
            where: { id: managerId },
        });
        if (!manager || manager.role !== 'dept_head') {
            throw new Error('El usuario debe tener rol dept_head');
        }
    }

    return prisma.department.create({
        data: {
            name,
            managerId: managerId || null,
        },
        include: {
            manager: { select: { id: true, username: true } },
        },
    });
};

/**
 * Update department manager (admin only)
 */
export const updateDepartmentManager = async (departmentId: string, managerId: string | null) => {
    // If assigning a manager, verify they are a dept_head
    if (managerId) {
        const manager = await prisma.user.findUnique({
            where: { id: managerId },
        });
        if (!manager || manager.role !== 'dept_head') {
            throw new Error('El usuario debe tener rol dept_head');
        }
    }

    return prisma.department.update({
        where: { id: departmentId },
        data: { managerId },
        include: {
            manager: { select: { id: true, username: true } },
        },
    });
};

/**
 * List all departments (admin sees all, dept_head sees their own)
 */
export const listDepartments = async (userId: string, userRole: string) => {
    if (userRole === 'admin') {
        return prisma.department.findMany({
            include: {
                manager: { select: { id: true, username: true } },
                _count: { select: { projects: true } },
            },
            orderBy: { name: 'asc' },
        });
    }
    if (userRole === 'dept_head') {
        return prisma.department.findMany({
            where: { managerId: userId },
            include: {
                manager: { select: { id: true, username: true } },
                _count: { select: { projects: true } },
            },
        });
    }
    return [];
};

/**
 * Get department by ID
 */
export const getDepartmentById = async (id: string) => {
    return prisma.department.findUnique({
        where: { id },
        include: {
            manager: { select: { id: true, username: true } },
            projects: {
                include: {
                    leader: { select: { id: true, username: true } },
                    _count: { select: { members: true } },
                },
            },
        },
    });
};

/**
 * Delete department (admin only)
 */
export const deleteDepartment = async (id: string) => {
    return prisma.department.delete({
        where: { id },
    });
};
