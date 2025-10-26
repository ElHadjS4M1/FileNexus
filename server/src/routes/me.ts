import { Router } from 'express';
import { createPublicKey } from 'node:crypto';
import { authenticate } from '../middleware/auth';
import { findUserById } from '../services/userService';
import { HttpError } from '../utils/httpError';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const user = await findUserById(req.authUser.id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/keys/materials', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const user = await findUserById(req.authUser.id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    if (user.status !== 'active') {
      throw new HttpError(409, 'User not initialized');
    }
    const publicKeyRecordRaw =
      typeof user.publicKeyJwk === 'object' && user.publicKeyJwk !== null
        ? (user.publicKeyJwk as Record<string, unknown>)
        : null;
    const jwkCandidate =
      publicKeyRecordRaw && typeof publicKeyRecordRaw.jwk === 'object'
        ? (publicKeyRecordRaw.jwk as JsonWebKey)
        : (publicKeyRecordRaw as unknown as JsonWebKey | null);
    const publicKeyPem =
      publicKeyRecordRaw && typeof publicKeyRecordRaw.pem === 'string'
        ? (publicKeyRecordRaw.pem as string)
        : jwkCandidate
          ? (createPublicKey({
              key: jwkCandidate,
              format: 'jwk',
            }).export({ type: 'spki', format: 'pem' }) as string)
          : null;
    const kdfInfo =
      typeof user.kdfClient === 'object' && user.kdfClient !== null
        ? (user.kdfClient as Record<string, unknown>).info
        : undefined;

    res.json({
      username: user.username,
      encryptedPrivateKey: user.privEnc.toString('base64'),
      encryptionMetadata: {
        iv: user.privNonce.toString('base64'),
        hkdfSalt: user.clientSalt.toString('base64'),
        hkdfInfo: kdfInfo ?? null,
      },
      publicKeyPem,
      // legacy fields for backwards compatibility
      privEnc: user.privEnc.toString('base64'),
      privNonce: user.privNonce.toString('base64'),
      clientSalt: user.clientSalt.toString('base64'),
      kdfClient: user.kdfClient,
      publicKeyJwk: user.publicKeyJwk,
    });
  } catch (error) {
    next(error);
  }
});

export const meRouter = router;
