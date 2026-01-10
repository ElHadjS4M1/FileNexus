import { prisma } from './prisma';

/**
 * Crear un nuevo departamento (solo admin)
 * El jefe es opcional - puede asignarse después
 */
export const createDepartment = async (name: string, managerId?: string) => {
    // Si se proporciona jefe, verificar que sea un dept_head
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
 * Actualizar jefe de departamento (solo admin)
 */
export const updateDepartmentManager = async (departmentId: string, managerId: string | null) => {
    // Si se asigna un jefe, verificar que sea un dept_head
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
 * Listar todos los departamentos (admin ve todos, dept_head ve el suyo)
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
 * Obtener departamento por ID
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
 * Eliminar departamento (solo admin)
 */
export const deleteDepartment = async (id: string) => {
    return prisma.department.delete({
        where: { id },
    });
};
