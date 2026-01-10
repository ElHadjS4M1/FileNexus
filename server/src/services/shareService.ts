import { prisma } from './prisma';

export type ShareFileInput = {
    fileId: string;
    userId: string;
    sharedById: string;
    encryptedKey: Buffer;
};

/**
 * Crea un registro de archivo compartido.
 */
export const shareFile = async (input: ShareFileInput) => {
    return prisma.fileShare.create({
        data: {
            fileId: input.fileId,
            userId: input.userId,
            sharedById: input.sharedById,
            encryptedKey: input.encryptedKey,
        },
        include: {
            user: { select: { username: true } },
        },
    });
};

/**
 * Obtiene archivos compartidos con un usuario específico.
 */
export const getFilesSharedWithUser = async (userId: string) => {
    return prisma.fileShare.findMany({
        where: { userId },
        include: {
            file: {
                include: {
                    owner: { select: { username: true } },
                },
            },
            sharedBy: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
};

/**
 * Obtiene todos los compartidos para un archivo específico (con quién se comparte).
 */
export const getFileShares = async (fileId: string, ownerId: string) => {
    // Verificar propiedad primero
    const file = await prisma.file.findFirst({
        where: { id: fileId, ownerId },
    });
    if (!file) {
        return null;
    }
    return prisma.fileShare.findMany({
        where: { fileId },
        include: {
            user: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
};

/**
 * Revoca archivo compartido (elimina acceso para un usuario).
 */
export const revokeFileShare = async (fileId: string, userId: string, ownerId: string) => {
    // Verificar propiedad primero
    const file = await prisma.file.findFirst({
        where: { id: fileId, ownerId },
    });
    if (!file) {
        return null;
    }
    return prisma.fileShare.delete({
        where: {
            fileId_userId: { fileId, userId },
        },
    });
};

/**
 * Obtiene un registro de compartido específico para acceso a archivo.
 */
export const getFileShareForUser = async (fileId: string, userId: string) => {
    return prisma.fileShare.findUnique({
        where: {
            fileId_userId: { fileId, userId },
        },
        include: {
            file: {
                include: {
                    owner: { select: { publicKeyJwk: true } },
                },
            },
        },
    });
};
