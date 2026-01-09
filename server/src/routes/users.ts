import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { HttpError } from '../utils/httpError';

const router = Router();

router.use(authenticate);

/**
 * Search users by username (for sharing files).
 */
router.get('/search', async (req, res, next) => {
    try {
        if (!req.authUser) {
            throw new HttpError(401, 'Authentication required');
        }

        const query = (req.query.q as string) || '';
        if (query.length < 2) {
            return res.json({ users: [] });
        }

        const users = await prisma.user.findMany({
            where: {
                username: { contains: query, mode: 'insensitive' },
                id: { not: req.authUser.id }, // Exclude current user
                status: 'active', // Only active users can receive shares
            },
            select: {
                id: true,
                username: true,
                role: true,
            },
            take: 5,
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

export default router;
