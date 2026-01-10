import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { HttpError } from '../utils/httpError';

const router = Router();

router.use(authenticate);

/**
 * Search users by username (for sharing files, adding to projects).
 * Supports optional role filter and unassigned filter.
 */
router.get('/search', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const query = (req.query.q as string) || '';
        const roleFilter = req.query.role as string | undefined;
        const unassignedOnly = req.query.unassigned === 'true';

        // Allow empty query when filtering by role (for dropdowns)
        if (query.length < 2 && !roleFilter) {
            return res.json({ users: [] });
        }

        const whereClause: Record<string, unknown> = {
            id: { not: req.authUser.id },
            status: 'active',
        };

        if (query.length >= 2) {
            whereClause.username = { contains: query, mode: 'insensitive' };
        }

        if (roleFilter) {
            whereClause.role = roleFilter;
        }

        // Filter out already assigned users
        if (unassignedOnly && roleFilter === 'dept_head') {
            whereClause.managedDepartment = null;
        }
        if (unassignedOnly && roleFilter === 'project_head') {
            whereClause.ledProjects = { none: {} };
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                username: true,
                role: true,
            },
            take: 10,
        });

        res.json({ users });
    } catch (error) {
        next(error);
    }
});

/**
 * Get user's public key (for encrypting file key).
 */
router.get('/:userId/publicKey', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                publicKeyJwk: true,
            },
        });

        if (!user) {
            throw new HttpError(404, 'User not found');
        }

        // Extract the JWK from the stored format (can be {jwk: ..., pem: ...} or direct JWK)
        const storedKey = user.publicKeyJwk as Record<string, unknown>;
        const jwk = storedKey?.jwk || storedKey;

        res.json({
            id: user.id,
            username: user.username,
            publicKeyJwk: jwk,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Stats for regular user dashboard
 */
router.get('/stats', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }
        if (req.authUser.role !== 'user') {
            throw new HttpError(403, 'Solo usuarios regulares pueden acceder');
        }

        const now = new Date();
        const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

        // Get files owned by user created in last 30 days
        const files = await prisma.file.findMany({
            where: {
                ownerId: req.authUser.id,
                createdAt: { gte: twentyNineDaysAgo }
            },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Group by day
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

        // Last 5 owned files
        const recentOwnedFiles = await prisma.file.findMany({
            where: { ownerId: req.authUser.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, filename: true, sizeBytes: true, createdAt: true },
        });

        // Last 5 shared files (shared with this user)
        const recentSharedFiles = await prisma.fileShare.findMany({
            where: { userId: req.authUser.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                file: {
                    include: { owner: { select: { username: true } } }
                }
            },
        });

        const totalOwnedFiles = await prisma.file.count({
            where: { ownerId: req.authUser.id },
        });

        const totalSharedFiles = await prisma.fileShare.count({
            where: { userId: req.authUser.id },
        });

        res.json({
            fileGrowth: Object.entries(fileGrowth).map(([date, count]) => ({ date, count })),
            recentOwnedFiles,
            recentSharedFiles: recentSharedFiles.map(s => ({
                ...s.file,
                sharedBy: s.file.owner?.username,
            })),
            totalOwnedFiles,
            totalSharedFiles,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
