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
      const { filename, sizeBytes, aeadNonce, ekOwner, hashC, meta: metaRaw } = req.body;

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
    const file = await getFileForOwner(req.params.id, req.authUser.id);
    if (!file) {
      throw new HttpError(404, 'File not found');
    }
    const ciphertext = await readCipherFile(file.filePath);
    res.json({
      id: file.id,
      filename: file.filename,
      ciphertext: ciphertext.toString('base64'),
      aeadNonce: file.aeadNonce.toString('base64'),
      ekOwner: file.ekOwner.toString('base64'),
      meta: file.meta,
      hashC: file.hashC?.toString('base64'),
    });
  } catch (error) {
    next(error);
  }
});

export const filesRouter = router;
