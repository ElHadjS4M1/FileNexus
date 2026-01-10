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
  signature?: Buffer;
  projectId?: string;
};

/**
 * Almacena un archivo cifrado para un usuario.
 * @param {FileCreateInput} payload - Contenido cifrado del sobre.
 * @returns {Promise<File>} Registro de archivo recién creado.
 */
export const saveFile = (payload: FileCreateInput): Promise<File> =>
  prisma.file.create({
    data: {
      id: payload.id,
      ownerId: payload.ownerId,
      filename: payload.filename,
      sizeBytes: payload.sizeBytes,
      meta: payload.meta as any,
      aeadNonce: payload.aeadNonce,
      filePath: payload.filePath,
      ekOwner: payload.ekOwner,
      hashC: payload.hashC,
      signature: payload.signature,
      projectId: payload.projectId,
    } as any,
  });

/**
 * Recupera un archivo por su identificador asegurando que pertenezca al propietario esperado.
 * @param {string} id - Identificador del archivo.
 * @param {string} ownerId - Identificador del propietario esperado.
 * @returns {Promise<File | null>} Archivo cuando existe y pertenece al solicitante.
 */
export const getFileForOwner = (id: string, ownerId: string): Promise<File | null> =>
  prisma.file.findFirst({ where: { id, ownerId } });

/**
 * Lista los archivos visibles para un propietario determinado.
 * @param {string} ownerId - Identificador del propietario.
 * @returns {Promise<File[]>} Colección de archivos.
 */
export const listFilesByOwner = (ownerId: string) =>
  prisma.file.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { username: true } } },
  });
