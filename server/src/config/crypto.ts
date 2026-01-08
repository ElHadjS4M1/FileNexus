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
 * Carga el par de claves JWT desde disco o genera un par efímero para desarrollo/pruebas.
 * @returns {JwtKeys} Par de claves RSA cargado o generado en formatos PEM y KeyObject.
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
 * Deriva la clave simétrica KEK utilizada para proteger los secretos TOTP.
 * @returns {Buffer} Búfer de 32 bytes listo para operaciones AES-256.
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
 * Genera un nonce aleatorio compatible con el requisito de 96 bits de AES-GCM.
 * @returns {Buffer} Búfer de nonce aleatorio de 12 bytes.
 */
export const generateNonce = (): Buffer => randomBytes(12);
