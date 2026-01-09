import { Router } from 'express';
import multer from 'multer';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { getFileForOwner, listFilesByOwner, saveFile } from '../services/fileService';
import { findUserById } from '../services/userService';
import { readCipherFile, writeCipherFile, writeCipherFileFromPath } from '../services/storageService';
import { HttpError } from '../utils/httpError';
import { prisma } from '../services/prisma';

const fileUploadSchema = z.object({
  filename: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  meta: z.record(z.any()).optional(),
  ciphertext: z.string(),
  aeadNonce: z.string(),
  ekOwner: z.string(),
  hashC: z.string().optional(),
});

const router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => cb(null, `cipher-${Date.now()}-${file.originalname || 'payload.bin'}`),
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GiB por archivo (ajustable)
  },
});

/**
 * Convierte cargas codificadas en base64 en búferes binarios.
 * @param {string | undefined} value - Cadena codificada en base64.
 * @returns {Buffer | undefined} Búfer decodificado.
 */
const b64 = (value: string | undefined): Buffer | undefined =>
  value ? Buffer.from(value, 'base64') : undefined;

router.use(authenticate);

router.post('/', upload.single('ciphertext'), async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const user = await findUserById(req.authUser.id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    let saved;
    if (req.file) {
      const { filename, sizeBytes, aeadNonce, ekOwner, hashC, signature, meta: metaRaw } = req.body;

      if (!filename || !sizeBytes || !aeadNonce || !ekOwner) {
        throw new HttpError(400, 'Missing required multipart fields');
      }
      const size = Number.parseInt(sizeBytes, 10);
      if (!Number.isFinite(size) || size <= 0) {
        throw new HttpError(400, 'Invalid sizeBytes');
      }

      let parsedMeta: unknown;
      if (metaRaw) {
        try {
          parsedMeta = JSON.parse(metaRaw);
        } catch (error) {
          throw new HttpError(400, 'Invalid meta payload', { cause: error as Error });
        }
      }
      const storedFile = await writeCipherFileFromPath(user.username, req.file.path);
      saved = await saveFile({
        id: storedFile.id,
        ownerId: req.authUser.id,
        filename,
        sizeBytes: size,
        meta: parsedMeta,
        aeadNonce: Buffer.from(aeadNonce, 'base64'),
        ekOwner: Buffer.from(ekOwner, 'base64'),
        filePath: storedFile.relativePath,
        hashC: hashC ? Buffer.from(hashC, 'base64') : undefined,
        signature: signature ? Buffer.from(signature, 'base64') : undefined,
      });
    } else {
      const payload = fileUploadSchema.parse(req.body);
      const cipherBuffer = Buffer.from(payload.ciphertext, 'base64');
      const storedFile = await writeCipherFile(user.username, cipherBuffer);
      saved = await saveFile({
        id: storedFile.id,
        ownerId: req.authUser.id,
        filename: payload.filename,
        sizeBytes: payload.sizeBytes,
        meta: payload.meta,
        aeadNonce: Buffer.from(payload.aeadNonce, 'base64'),
        ekOwner: Buffer.from(payload.ekOwner, 'base64'),
        filePath: storedFile.relativePath,
        hashC: b64(payload.hashC),
      });
    }

    res.status(201).json({
      id: saved.id,
      filename: saved.filename,
      sizeBytes: saved.sizeBytes,
      createdAt: saved.createdAt,
    });
  } catch (error) {
    if (req.file) {
      await unlink(req.file.path).catch(() => undefined);
    }
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }

    const files = await listFilesByOwner(req.authUser.id);
    res.json({
      files: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        ownerUsername: file.owner.username,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const file = await prisma.file.findFirst({
      where: { id: req.params.id, ownerId: req.authUser.id },
      include: { owner: { select: { publicKeyJwk: true } } },
    });
    if (!file) {
      throw new HttpError(404, 'File not found');
    }
    const ciphertext = await readCipherFile(file.filePath);
    const ownerKey = file.owner.publicKeyJwk as Record<string, unknown>;
    res.json({
      id: file.id,
      filename: file.filename,
      ciphertext: ciphertext.toString('base64'),
      aeadNonce: file.aeadNonce.toString('base64'),
      ekOwner: file.ekOwner.toString('base64'),
      meta: file.meta,
      hashC: file.hashC?.toString('base64'),
      signature: file.signature?.toString('base64'),
      ownerPublicKey: ownerKey?.jwk || ownerKey,
    });
  } catch (error) {
    next(error);
  }
});

// Share a file with another user
router.post('/:id/share', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const { userId, encryptedKey } = req.body;
    if (!userId || !encryptedKey) {
      throw new HttpError(400, 'userId and encryptedKey are required');
    }

    // Verify ownership
    const file = await getFileForOwner(req.params.id, req.authUser.id);
    if (!file) {
      throw new HttpError(404, 'File not found or not owned by you');
    }

    const { shareFile } = await import('../services/shareService');
    const share = await shareFile({
      fileId: req.params.id,
      userId,
      sharedById: req.authUser.id,
      encryptedKey: Buffer.from(encryptedKey, 'base64'),
    });

    res.status(201).json({
      id: share.id,
      sharedWith: share.user.username,
      createdAt: share.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

// Get shares for a file
router.get('/:id/shares', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const { getFileShares } = await import('../services/shareService');
    const shares = await getFileShares(req.params.id, req.authUser.id);
    if (shares === null) {
      throw new HttpError(404, 'File not found or not owned by you');
    }
    res.json({
      shares: shares.map((s) => ({
        id: s.id,
        userId: s.user.id,
        username: s.user.username,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Revoke file share
router.delete('/:id/shares/:userId', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const { revokeFileShare } = await import('../services/shareService');
    const result = await revokeFileShare(req.params.id, req.params.userId, req.authUser.id);
    if (!result) {
      throw new HttpError(404, 'File not found or not owned by you');
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get files shared with current user
router.get('/shared/with-me', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const { getFilesSharedWithUser } = await import('../services/shareService');
    const shares = await getFilesSharedWithUser(req.authUser.id);
    res.json({
      files: shares.map((s) => ({
        id: s.file.id,
        filename: s.file.filename,
        sizeBytes: s.file.sizeBytes,
        ownerUsername: s.file.owner.username,
        sharedByUsername: s.sharedBy.username,
        createdAt: s.file.createdAt,
        sharedAt: s.createdAt,
        encryptedKey: s.encryptedKey.toString('base64'),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Download shared file
router.get('/shared/:id', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const { getFileShareForUser } = await import('../services/shareService');
    const share = await getFileShareForUser(req.params.id, req.authUser.id);
    if (!share) {
      throw new HttpError(404, 'File not found or not shared with you');
    }
    const ciphertext = await readCipherFile(share.file.filePath);
    const ownerKey = share.file.owner.publicKeyJwk as Record<string, unknown>;
    res.json({
      id: share.file.id,
      filename: share.file.filename,
      ciphertext: ciphertext.toString('base64'),
      aeadNonce: share.file.aeadNonce.toString('base64'),
      encryptedKey: share.encryptedKey.toString('base64'),
      meta: share.file.meta,
      hashC: share.file.hashC?.toString('base64'),
      signature: share.file.signature?.toString('base64'),
      ownerPublicKey: ownerKey?.jwk || ownerKey,
    });
  } catch (error) {
    next(error);
  }
});

export const filesRouter = router;
