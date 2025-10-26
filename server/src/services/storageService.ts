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
 * Persists encrypted file bytes on disk inside ./files/<username> directory.
 * @param {string} username - Owner username to scope storage path.
 * @param {Buffer} ciphertext - Encrypted file bytes.
 * @returns {Promise<StoredFile>} Stored file metadata including generated id and paths.
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
 * Moves an encrypted file residing in a temporary path into the managed storage tree.
 * @param {string} username - Owner username.
 * @param {string} tempPath - Absolute path to the temporary file.
 * @returns {Promise<StoredFile>} Stored file metadata including generated id and paths.
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
 * Reads encrypted bytes from disk using the stored relative path.
 * @param {string} relativePath - Relative path stored in database.
 * @returns {Promise<Buffer>} File contents.
 */
export const readCipherFile = async (relativePath: string): Promise<Buffer> => {
  const absolutePath = resolve(BASE_DIR, relativePath);
  return readFile(absolutePath);
};
