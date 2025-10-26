import type { File } from '@prisma/client';
import { prisma } from './prisma';

export type FileCreateInput = {
  id?: string;
  ownerId: string;
  filename: string;
  sizeBytes: number;
  meta?: unknown;
  aeadNonce: Buffer;
  filePath: string;
  ekOwner: Buffer;
  hashC?: Buffer;
};

/**
 * Stores an encrypted file payload for a user.
 * @param {FileCreateInput} payload - Encrypted envelope contents.
 * @returns {Promise<File>} Newly created file entry.
 */
export const saveFile = (payload: FileCreateInput): Promise<File> =>
  prisma.file.create({
    data: {
      id: payload.id,
      ownerId: payload.ownerId,
      filename: payload.filename,
      sizeBytes: payload.sizeBytes,
      meta: payload.meta,
      aeadNonce: payload.aeadNonce,
      filePath: payload.filePath,
      ekOwner: payload.ekOwner,
      hashC: payload.hashC,
    },
  });

/**
 * Retrieves a file by id ensuring it belongs to the expected owner.
 * @param {string} id - File identifier.
 * @param {string} ownerId - Expected owner id.
 * @returns {Promise<File | null>} File when found and owned by caller.
 */
export const getFileForOwner = (id: string, ownerId: string): Promise<File | null> =>
  prisma.file.findFirst({ where: { id, ownerId } });

/**
 * Lists the files visible to a particular owner.
 * @param {string} ownerId - Owner id.
 * @returns {Promise<File[]>} Collection of files.
 */
export const listFilesByOwner = (ownerId: string): Promise<File[]> =>
  prisma.file.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
