import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const BASE_DIR = resolve(process.cwd(), 'files');

export type StoredFile = {
  id: string;
  absolutePath: string;
  relativePath: string;
};

/**
 * Persiste bytes de archivos cifrados en disco dentro del directorio ./files/<username>.
 * @param {string} username - Nombre de usuario del propietario para acotar la ruta de almacenamiento.
 * @param {Buffer} ciphertext - Bytes cifrados del archivo.
 * @returns {Promise<StoredFile>} Metadatos del archivo almacenado, incluido el id generado y las rutas.
 */
export const writeCipherFile = async (
  username: string,
  ciphertext: Buffer,
): Promise<StoredFile> => {
  const fileId = randomUUID();
  const relativePath = `${username}/${fileId}.bin`;
  const absolutePath = resolve(BASE_DIR, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, ciphertext);
  return {
    id: fileId,
    absolutePath,
    relativePath,
  };
};

/**
 * Mueve un archivo cifrado que reside en una ruta temporal hacia el árbol de almacenamiento gestionado.
 * @param {string} username - Nombre de usuario del propietario.
 * @param {string} tempPath - Ruta absoluta al archivo temporal.
 * @returns {Promise<StoredFile>} Metadatos del archivo almacenado, incluido el id generado y las rutas.
 */
export const writeCipherFileFromPath = async (
  username: string,
  tempPath: string,
): Promise<StoredFile> => {
  const fileId = randomUUID();
  const relativePath = `${username}/${fileId}.bin`;
  const absolutePath = resolve(BASE_DIR, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await rename(tempPath, absolutePath);
  return {
    id: fileId,
    absolutePath,
    relativePath,
  };
};

/**
 * Lee bytes cifrados desde disco usando la ruta relativa almacenada.
 * @param {string} relativePath - Ruta relativa guardada en la base de datos.
 * @returns {Promise<Buffer>} Contenido del archivo.
 */
export const readCipherFile = async (relativePath: string): Promise<Buffer> => {
  const absolutePath = resolve(BASE_DIR, relativePath);
  return readFile(absolutePath);
};
