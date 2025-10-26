import { readFileSync } from 'node:fs';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { appEnv } from './env';

type JwtKeys = {
  privateKey: KeyObject;
  publicKey: KeyObject;
  pemPrivate: string;
  pemPublic: string;
};

let cachedKeys: JwtKeys | null = null;
let cachedKek: Buffer | null = null;

/**
 * Loads the JWT key pair either from disk or generates an ephemeral pair for development/testing.
 * @returns {JwtKeys} Loaded or generated RSA key pair in PEM and KeyObject formats.
 */
export const loadJwtKeys = (): JwtKeys => {
  if (cachedKeys) {
    return cachedKeys;
  }

  if (appEnv.JWT_PRIVATE_KEY_PATH && appEnv.JWT_PUBLIC_KEY_PATH) {
    const pemPrivate = readFileSync(appEnv.JWT_PRIVATE_KEY_PATH, 'utf-8');
    const pemPublic = readFileSync(appEnv.JWT_PUBLIC_KEY_PATH, 'utf-8');
    cachedKeys = {
      privateKey: createPrivateKey(pemPrivate),
      publicKey: createPublicKey(pemPublic),
      pemPrivate,
      pemPublic,
    };
    return cachedKeys;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicExponent: 0x10001,
  });
  const pemPrivate = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const pemPublic = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

  cachedKeys = { privateKey, publicKey, pemPrivate, pemPublic };
  return cachedKeys;
};

/**
 * Derives the symmetric Key Encryption Key (KEK) used to wrap TOTP secrets.
 * @returns {Buffer} 32-byte buffer ready for AES-256 operations.
 */
export const getServerKek = (): Buffer => {
  if (cachedKek) {
    return cachedKek;
  }

  const hash = createHash('sha256').update(appEnv.SERVER_KEK_SECRET).digest();
  cachedKek = hash;
  return cachedKek;
};

/**
 * Generates a random nonce compatible with AES-GCM 96-bit requirement.
 * @returns {Buffer} 12-byte random nonce buffer.
 */
export const generateNonce = (): Buffer => randomBytes(12);
