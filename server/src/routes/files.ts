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

    const projectId = req.body.projectId as string | undefined;

    // Verificar si el usuario tiene acceso al proyecto si se proporciona projectId
    if (projectId) {
      const project = await (prisma as any).project.findUnique({
        where: { id: projectId },
        include: { members: true },
      });
      if (!project) {
        throw new HttpError(404, 'Project not found');
      }
      // El usuario debe ser líder o miembro del proyecto
      const isMember = project.leaderId === req.authUser.id ||
        project.members.some((m: any) => m.userId === req.authUser!.id);
      if (!isMember) {
        throw new HttpError(403, 'No tienes acceso a este proyecto');
      }
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
        projectId,
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
        projectId,
      });
    }

    // Compartir automáticamente con miembros del proyecto si se proporcionan projectId y encryptedKeys
    if (projectId && saved) {
      // Analizar encryptedKeys del cuerpo de la solicitud (el cliente envía un array de {userId, encryptedKey})
      let encryptedKeysRaw = req.body.encryptedKeys;
      if (typeof encryptedKeysRaw === 'string') {
        try {
          encryptedKeysRaw = JSON.parse(encryptedKeysRaw);
        } catch {
          // empty, ignore parse error
        }
      }

      if (Array.isArray(encryptedKeysRaw) && encryptedKeysRaw.length > 0) {
        // Crear FileShare para cada destinatario
        for (const entry of encryptedKeysRaw) {
          if (entry.userId && entry.encryptedKey) {
            await prisma.fileShare.create({
              data: {
                fileId: saved.id,
                userId: entry.userId,
                sharedById: req.authUser.id,
                encryptedKey: Buffer.from(entry.encryptedKey, 'base64'),
              },
            });
          }
        }
      }
    }

    res.status(201).json({
      id: saved.id,
      filename: saved.filename,
      sizeBytes: saved.sizeBytes,
      createdAt: saved.createdAt,
      projectId: projectId || null,
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
    const ownerKey = file.owner.publicKeyJwk as unknown as Record<string, unknown>;
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

// Compartir un archivo con otro usuario
router.post('/:id/share', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }
    const { userId, encryptedKey } = req.body;
    if (!userId || !encryptedKey) {
      throw new HttpError(400, 'userId and encryptedKey are required');
    }

    // Verificar propiedad
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

// Obtener compartidos para un archivo
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

// Revocar archivo compartido
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

// Compartir archivo existente con el equipo
router.post('/:id/share-with-team', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }

    const fileId = req.params.id;
    const { projectId, encryptedKeys } = req.body;

    // Verificar acceso al archivo y membresía del proyecto
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new HttpError(404, 'File not found');
    }

    const isOwner = file.ownerId === req.authUser.id;
    let hasAccess = isOwner;

    if (!isOwner) {
      // Verificar si el usuario tiene acceso compartido
      const share = await prisma.fileShare.findUnique({
        where: {
          fileId_userId: { fileId, userId: req.authUser.id },
        },
      });
      hasAccess = !!share;
    }

    // Permitir si es propietario O (archivo está en proyecto Y usuario tiene acceso Y proyecto destino coincide)
    if (!isOwner && (!(file as any).projectId || (file as any).projectId !== projectId || !hasAccess)) {
      throw new HttpError(403, 'You do not have permission to share this file');
    }

    // Actualizar projectId del archivo solo si es propietario y no está establecido
    if (isOwner && !(file as any).projectId) {
      await prisma.file.update({
        where: { id: fileId },
        data: { projectId } as any,
      });
    }

    // Crear FileShares para cada destinatario
    let sharesCreated = 0;
    if (Array.isArray(encryptedKeys)) {
      for (const entry of encryptedKeys) {
        if (entry.userId && entry.encryptedKey) {
          // Verificar si el compartido ya existe
          const existing = await prisma.fileShare.findUnique({
            where: {
              fileId_userId: { fileId, userId: entry.userId },
            } as any,
          });
          if (!existing) {
            await prisma.fileShare.create({
              data: {
                fileId,
                userId: entry.userId,
                sharedById: req.authUser.id,
                encryptedKey: Buffer.from(entry.encryptedKey, 'base64'),
              },
            });
            sharesCreated++;
          }
        }
      }
    }

    res.json({ success: true, sharesCreated });
  } catch (error) {
    next(error);
  }
});

// Obtener archivos compartidos con el usuario actual
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

// Descargar archivo compartido
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
    const ownerKey = share.file.owner.publicKeyJwk as unknown as Record<string, unknown>;
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

// Obtener archivos compartidos vía proyecto (solo equipo)
router.get('/shared/project/:projectId', async (req, res, next) => {
  try {
    if (!req.authUser) {
      throw new HttpError(401, 'Authentication required');
    }

    const projectId = req.params.projectId;

    // Obtener archivos que pertenecen al proyecto y están compartidos con el usuario
    const shares = await prisma.fileShare.findMany({
      where: {
        userId: req.authUser.id,
        file: {
          projectId: projectId,
        },
      },
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

    // Obtener archivos propiedad del usuario que están en el proyecto
    const myFiles = await prisma.file.findMany({
      where: {
        projectId: projectId,
        ownerId: req.authUser.id,
      },
      include: {
        owner: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Combinar y formatear
    const allFiles = [
      ...(shares as any[]).map((s) => ({
        id: s.file.id,
        filename: s.file.filename,
        sizeBytes: s.file.sizeBytes,
        ownerUsername: s.file.owner.username,
        sharedByUsername: s.sharedBy.username,
        createdAt: s.file.createdAt,
        sharedAt: s.createdAt,
        projectId: s.file.projectId,
      })),
      ...(myFiles as any[]).map((f) => ({
        id: f.id,
        filename: f.filename,
        sizeBytes: f.sizeBytes,
        ownerUsername: f.owner.username,
        sharedByUsername: f.owner.username, // Compartido por mí (propietario)
        createdAt: f.createdAt,
        sharedAt: f.createdAt, // Usando fecha de creación como fecha de compartido para propietario
        projectId: f.projectId,
      })),
    ];

    // Ordenar por sharedAt/createdAt desc
    allFiles.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime());

    res.json({
      files: allFiles,
    });
  } catch (error) {
    next(error);
  }
});

export const filesRouter = router;
