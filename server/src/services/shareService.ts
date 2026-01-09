import { prisma } from './prisma';

export type ShareFileInput = {
    fileId: string;
    userId: string;
    sharedById: string;
    encryptedKey: Buffer;
};

/**
 * Creates a file share record.
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
 * Gets files shared with a specific user.
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
 * Gets all shares for a specific file (who it's shared with).
 */
export const getFileShares = async (fileId: string, ownerId: string) => {
    // Verify ownership first
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
 * Revokes file share (removes access for a user).
 */
export const revokeFileShare = async (fileId: string, userId: string, ownerId: string) => {
    // Verify ownership first
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
 * Gets a specific share record for file access.
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
