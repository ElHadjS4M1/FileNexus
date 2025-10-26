import { createCipheriv, createDecipheriv } from 'node:crypto';
import { generateNonce, getServerKek } from '../config/crypto';

const AUTH_TAG_LENGTH = 16;
const NONCE_LENGTH = 12;

/**
 * Encrypts arbitrary data using the server KEK via AES-256-GCM.
 * @param {Buffer} plaintext - Raw bytes that must be wrapped.
 * @returns {Buffer} Concatenation of nonce + ciphertext + authTag.
 */
export const encryptWithKek = (plaintext: Buffer): Buffer => {
  const key = getServerKek();
  const nonce = generateNonce();
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([nonce, encrypted, authTag]);
};

/**
 * Decrypts payloads previously produced by encryptWithKek.
 * @param {Buffer} payload - Combined nonce + ciphertext + authTag buffer.
 * @returns {Buffer} Decrypted bytes.
 */
export const decryptWithKek = (payload: Buffer): Buffer => {
  const key = getServerKek();
  const nonce = payload.subarray(0, NONCE_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(NONCE_LENGTH, payload.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};
